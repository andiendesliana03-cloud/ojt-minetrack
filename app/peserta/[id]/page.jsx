
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// DETAIL PESERTA - ADMIN / MENTOR
// KALENDER GLOBAL WEEK 01-25
// INPUT ACHIEVEMENT TANPA VERIFIKASI MANUAL
// ======================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "🎓",
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "📣",
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "👥",
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🗺️",
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
  },
];

// ======================================================
// UTILITIES
// ======================================================

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

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

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function today() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const get = (type) =>
    parts.find(
      (item) => item.type === type
    )?.value || "";

  return (
    `${get("year")}-${get("month")}-${get("day")}`
  );
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

function formatNumber(value, digits = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }
  );
}

function formatScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return formatNumber(number, 2);
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

function averageScores(rows) {
  const values = rows
    .map((row) => row.score)
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function cappedPercent(actual, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(
      0,
      (actual / target) * 100
    )
  );
}

// ======================================================
// KALENDER GLOBAL 25 MINGGU
//
// WEEK 01: 12 - 18 SEP 2026
// 19 SEP 2026 TIDAK TERMASUK WEEK
// WEEK 02: 20 - 26 SEP 2026
// WEEK 07: 25 - 31 OKT 2026
// WEEK 08: 01 - 07 NOV 2026
// WEEK 25: 28 FEB - 06 MAR 2027
// ======================================================

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? "2026-09-12"
        : addDays(
            "2026-09-20",
            (index - 1) * 7
          );

    return {
      week: index + 1,
      start,
      end: addDays(start, 6),
    };
  }
);

function globalWeekOf(dateValue) {
  const date = String(dateValue ?? "")
    .slice(0, 10);

  if (!parseDate(date)) {
    return null;
  }

  const found = GLOBAL_WEEKS.find(
    (item) =>
      date >= item.start &&
      date <= item.end
  );

  return found?.week ?? null;
}

function getGlobalWeek(weekNumber) {
  return (
    GLOBAL_WEEKS.find(
      (item) =>
        item.week === Number(weekNumber)
    ) || null
  );
}

function getProgramWeekRange(
  weekNumber,
  program
) {
  const global = getGlobalWeek(
    weekNumber
  );

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const programStart = String(
    program.start_date
  ).slice(0, 10);

  const programEnd = parseDate(
    program.end_date
  )
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > programStart
      ? global.start
      : programStart;

  const end =
    programEnd &&
    programEnd < global.end
      ? programEnd
      : global.end;

  if (start > end) return null;

  return {
    start,
    end,
  };
}

function getAvailableWeeks(program) {
  if (!program) return [];

  return GLOBAL_WEEKS.filter(
    (item) =>
      getProgramWeekRange(
        item.week,
        program
      )
  );
}

function determineInitialWeek(
  program,
  records = []
) {
  const available =
    getAvailableWeeks(program);

  if (!available.length) return 1;

  const now = today();

  // Jika tanggal sekarang berada
  // dalam Week Global program,
  // langsung pilih minggu tersebut.

  const current = available.find(
    (item) => {
      const range =
        getProgramWeekRange(
          item.week,
          program
        );

      return (
        range &&
        now >= range.start &&
        now <= range.end
      );
    }
  );

  if (current) return current.week;

  // Bila program sudah selesai,
  // tampilkan minggu dengan data terbaru.

  const recordedWeeks = records
    .map(
      (item) =>
        globalWeekOf(
          item.activity_date
        )
    )
    .filter(
      (week) =>
        week !== null &&
        available.some(
          (item) =>
            item.week === week
        )
    );

  if (recordedWeeks.length) {
    return Math.max(
      ...recordedWeeks
    );
  }

  const upcoming = available.find(
    (item) => {
      const range =
        getProgramWeekRange(
          item.week,
          program
        );

      return (
        range &&
        range.start > now
      );
    }
  );

  return upcoming
    ? upcoming.week
    : available[
        available.length - 1
      ].week;
}

// ======================================================
// PEMETAAN KATEGORI DATABASE
//
// training / internaltraining
// orientasi / orientasiarea
// fisik / physical
// ======================================================

function categoryFromType(value) {
  const key = normalize(value);

  if (
    [
      "fisik",
      "physical",
    ].includes(key)
  ) {
    return "Fisik";
  }

  if (
    [
      "training",
      "internaltraining",
      "pelatihan",
    ].includes(key)
  ) {
    return "Training";
  }

  if (
    [
      "sosialisasi",
      "socialization",
    ].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (
    [
      "coaching",
      "pembinaan",
    ].includes(key)
  ) {
    return "Coaching";
  }

  if (
    [
      "orientasi",
      "orientasiarea",
      "areaorientation",
    ].includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    [
      "hazard",
      "hazardidentification",
      "identifikasibahaya",
    ].includes(key)
  ) {
    return "Hazard";
  }

  return null;
}

function ProgressBar({ value }) {
  const percentage = Math.min(
    100,
    Math.max(
      0,
      Number(value) || 0
    )
  );

  return (
    <div
      className="mt-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <span
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  );
}

function AchievementMenu({
  icon,
  title,
  description,
  detail,
  variant,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        `mt-ach-menu ${variant || ""}`
      }
      onClick={onClick}
    >
      <div className="mt-ach-menu-top">
        <div className="mt-ach-menu-icon">
          {icon}
        </div>

        <span className="mt-ach-menu-arrow">
          ↗
        </span>
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      <div className="mt-ach-menu-bottom">
        <span>{detail}</span>
        <strong>Buka Menu →</strong>
      </div>
    </button>
  );
}

// ======================================================
// HALAMAN DETAIL PESERTA
// ======================================================

export default function DetailPeserta() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(
    params?.id
  )
    ? params.id[0]
    : params?.id;

  const [mentor, setMentor] =
    useState(null);

  const [program, setProgram] =
    useState(null);

  const [types, setTypes] =
    useState([]);

  const [
    achievements,
    setAchievements,
  ] = useState([]);

  const [postTests, setPostTests] =
    useState([]);

  const [practice, setPractice] =
    useState([]);

  const [samapta, setSamapta] =
    useState([]);

  const [simper, setSimper] =
    useState(null);

  const [week, setWeek] =
    useState(1);

  const [panel, setPanel] =
    useState("dashboard");

  // POST TEST

  const [testDate, setTestDate] =
    useState(today());

  const [testScore, setTestScore] =
    useState("");

  const [testNotes, setTestNotes] =
    useState("");

  const [editTestId, setEditTestId] =
    useState(null);

  // STATUS

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [savingTest, setSavingTest] =
    useState(false);

  const [testActionId, setTestActionId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const role = roleOf(
    mentor?.role
  );

  const isAdmin = role === "admin";
  const isMentor = role === "mentor";

  // ====================================================
  // AMBIL RECORD SUPABASE
  // ====================================================

  async function fetchRecords() {
    const results =
      await Promise.all([
        supabase
          .from(
            "achievement_records"
          )
          .select(
            "id,type_code,activity_date,distance_km,status"
          )
          .eq(
            "program_id",
            programId
          )
          .order(
            "activity_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from(
            "post_test_scores"
          )
          .select(
            "id,test_date,score,notes,created_at"
          )
          .eq(
            "program_id",
            programId
          )
          .order(
            "test_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from(
            "weekly_practice_scores"
          )
          .select(
            "id,practice_date,practice_name,score"
          )
          .eq(
            "program_id",
            programId
          ),

        supabase
          .from(
            "samapta_records"
          )
          .select(
            "id,test_date,test_type,score,outcome,result_value"
          )
          .eq(
            "program_id",
            programId
          ),

        supabase
          .from(
            "simper_records"
          )
          .select(
            "id,administration_status,theory_status,practice_status,status,graduation_date,notes"
          )
          .eq(
            "program_id",
            programId
          )
          .maybeSingle(),
      ]);

    const labels = [
      "Achievement",
      "Post-Test",
      "Praktik",
      "Samapta",
      "SIMPER",
    ];

    results.forEach(
      (result, index) => {
        if (result.error) {
          throw new Error(
            `${labels[index]}: ${result.error.message}`
          );
        }
      }
    );

    return {
      achievements:
        results[0].data || [],

      postTests:
        results[1].data || [],

      practice:
        results[2].data || [],

      samapta:
        results[3].data || [],

      simper:
        results[4].data || null,
    };
  }

  function applyRecords(records) {
    setAchievements(
      records.achievements
    );

    setPostTests(
      records.postTests
    );

    setPractice(
      records.practice
    );

    setSamapta(
      records.samapta
    );

    setSimper(
      records.simper
    );
  }

  // ====================================================
  // LOAD AWAL
  // ====================================================

  useEffect(() => {
    if (!programId) {
      setError(
        "ID program tidak tersedia."
      );

      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !user
        ) {
          router.replace(
            "/login"
          );
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id,full_name,role"
          )
          .eq(
            "id",
            user.id
          )
          .single();

        if (profileError) {
          throw profileError;
        }

        const currentRole =
          roleOf(
            profile?.role
          );

        if (
          [
            "participant",
            "peserta",
          ].includes(currentRole)
        ) {
          router.replace(
            "/dashboard-peserta"
          );
          return;
        }

        if (
          ![
            "admin",
            "mentor",
          ].includes(currentRole)
        ) {
          throw new Error(
            "Halaman ini hanya untuk Admin atau Mentor."
          );
        }

        const programResult =
          await supabase
            .from(
              "ojt_programs"
            )
            .select(`
              id,
              site,
              mentor_id,
              start_date,
              end_date,
              status,
              peserta:profiles!ojt_programs_participant_id_fkey(
                full_name,
                department
              )
            `)
            .eq(
              "id",
              programId
            )
            .maybeSingle();

        if (
          programResult.error
        ) {
          throw programResult.error;
        }

        if (
          !programResult.data
        ) {
          throw new Error(
            "Program OJT tidak ditemukan atau akses tidak tersedia."
          );
        }

        if (
          !parseDate(
            programResult.data
              .start_date
          )
        ) {
          throw new Error(
            "Tanggal mulai program OJT tidak valid."
          );
        }

        const [
          typesResult,
          records,
        ] = await Promise.all([
          supabase
            .from(
              "achievement_types"
            )
            .select(
              "code,name"
            )
            .order(
              "name"
            ),

          fetchRecords(),
        ]);

        if (
          typesResult.error
        ) {
          throw typesResult.error;
        }

        if (!active) return;

        setMentor(
          profile
        );

        setProgram(
          programResult.data
        );

        setTypes(
          typesResult.data || []
        );

        applyRecords(
          records
        );

        // PERBAIKAN UTAMA:
        // Week dipilih berdasarkan
        // Kalender Global, bukan
        // tanggal mulai peserta.

        const initialWeek =
          determineInitialWeek(
            programResult.data,
            records.achievements
          );

        setWeek(
          initialWeek
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memuat data peserta."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  // ====================================================
  // REFRESH
  // ====================================================

  async function refresh() {
    if (
      refreshing ||
      loading ||
      !programId ||
      !mentor ||
      !program
    ) {
      return;
    }

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      const records =
        await fetchRecords();

      applyRecords(
        records
      );
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  function openPanel(name) {
    setPanel(name);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ====================================================
  // POST TEST - TETAP DIPERTAHANKAN
  // ====================================================

  async function reloadTests() {
    const {
      data,
      error: err,
    } = await supabase
      .from(
        "post_test_scores"
      )
      .select(
        "id,test_date,score,notes,created_at"
      )
      .eq(
        "program_id",
        programId
      )
      .order(
        "test_date",
        {
          ascending: false,
        }
      );

    if (err) throw err;

    setPostTests(
      data || []
    );
  }

  function resetTest() {
    setEditTestId(null);
    setTestDate(today());
    setTestScore("");
    setTestNotes("");
  }

  async function saveTest(event) {
    event.preventDefault();

    if (
      !mentor ||
      !program ||
      savingTest ||
      testActionId
    ) {
      return;
    }

    const numericScore =
      Number(testScore);

    if (
      !testDate ||
      !parseDate(testDate) ||
      testScore.trim() === "" ||
      !Number.isFinite(
        numericScore
      ) ||
      numericScore < 0 ||
      numericScore > 100
    ) {
      setError(
        "Nilai Post-Test harus antara 0–100 dan tanggal harus valid."
      );
      return;
    }

    // Pastikan tanggal penilaian
    // berada dalam periode OJT
    // dan Kalender Global.

    const globalWeek =
      globalWeekOf(
        testDate
      );

    if (
      globalWeek === null ||
      !getProgramWeekRange(
        globalWeek,
        program
      )
    ) {
      setError(
        "Tanggal Post-Test harus berada pada Week Global dalam periode OJT peserta."
      );
      return;
    }

    if (
      testDate <
        program.start_date ||
      (
        parseDate(
          program.end_date
        ) &&
        testDate >
          program.end_date
      )
    ) {
      setError(
        "Tanggal Post-Test berada di luar periode OJT peserta."
      );
      return;
    }

    setSavingTest(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        test_date:
          testDate,

        score:
          numericScore,

        notes:
          testNotes.trim() ||
          null,
      };

      const result =
        editTestId
          ? await supabase
              .from(
                "post_test_scores"
              )
              .update(
                payload
              )
              .eq(
                "id",
                editTestId
              )
              .eq(
                "program_id",
                programId
              )
              .select("id")
          : await supabase
              .from(
                "post_test_scores"
              )
              .insert({
                ...payload,

                program_id:
                  programId,

                created_by:
                  mentor.id,
              })
              .select("id");

      if (
        result.error
      ) {
        throw result.error;
      }

      if (
        !result.data?.length
      ) {
        throw new Error(
          "Nilai tidak berhasil disimpan. Periksa izin database."
        );
      }

      await reloadTests();

      resetTest();

      setMessage(
        "Nilai Post-Test berhasil disimpan."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Gagal menyimpan Post-Test."
      );
    } finally {
      setSavingTest(false);
    }
  }

  function editTest(item) {
    setEditTestId(
      item.id
    );

    setTestDate(
      item.test_date
    );

    setTestScore(
      String(item.score)
    );

    setTestNotes(
      item.notes || ""
    );

    openPanel(
      "posttest"
    );
  }

  async function deleteTest(item) {
    if (
      !mentor ||
      !program ||
      savingTest ||
      testActionId
    ) {
      return;
    }

    if (
      !window.confirm(
        "Hapus nilai Post-Test ini?"
      )
    ) {
      return;
    }

    setTestActionId(
      item.id
    );

    setError("");
    setMessage("");

    try {
      const {
        data,
        error: err,
      } = await supabase
        .from(
          "post_test_scores"
        )
        .delete()
        .eq(
          "id",
          item.id
        )
        .eq(
          "program_id",
          programId
        )
        .select("id");

      if (err) throw err;

      if (
        !data?.length
      ) {
        throw new Error(
          "Nilai tidak terhapus. Periksa izin database."
        );
      }

      if (
        editTestId === item.id
      ) {
        resetTest();
      }

      await reloadTests();

      setMessage(
        "Nilai Post-Test berhasil dihapus."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Gagal menghapus Post-Test."
      );
    } finally {
      setTestActionId(null);
    }
  }

  // ====================================================
  // WEEK GLOBAL YANG DIIZINKAN
  // ====================================================

  const availableWeeks =
    useMemo(
      () =>
        getAvailableWeeks(
          program
        ),
      [program]
    );

  const selectedGlobalWeek =
    getGlobalWeek(
      week
    );

  const selectedProgramRange =
    getProgramWeekRange(
      week,
      program
    );

  const weekStart =
    selectedGlobalWeek?.start ||
    null;

  const weekEnd =
    selectedGlobalWeek?.end ||
    null;

  // ====================================================
  // REKAP ACHIEVEMENT MINGGU GLOBAL
  // ====================================================

  const weekly = useMemo(() => {
    const rows =
      achievements.filter(
        (item) => {
          const activityDate =
            String(
              item.activity_date ??
                ""
            ).slice(0, 10);

          const withinProgram =
            program &&
            activityDate >=
              String(
                program.start_date
              ).slice(0, 10) &&
            (
              !parseDate(
                program.end_date
              ) ||
              activityDate <=
                String(
                  program.end_date
                ).slice(0, 10)
            );

          return (
            withinProgram &&
            globalWeekOf(
              activityDate
            ) === week
          );
        }
      );

    const verified =
      rows.filter(
        (item) =>
          roleOf(
            item.status
          ) === "verified"
      );

    const pending =
      rows.filter(
        (item) =>
          roleOf(
            item.status
          ) === "pending"
      );

    // Pemetaan tipe database
    // dan kategori standar.

    const typeMap =
      new Map();

    types.forEach(
      (item) => {
        const category =
          categoryFromType(
            item.code
          ) ||
          categoryFromType(
            item.name
          );

        if (category) {
          typeMap.set(
            String(item.code),
            category
          );
        }
      }
    );

    const categories =
      TARGETS.map(
        (target) => {
          const matched =
            verified.filter(
              (item) => {
                const category =
                  typeMap.get(
                    String(
                      item.type_code
                    )
                  ) ||
                  categoryFromType(
                    item.type_code
                  );

                return (
                  category ===
                  target.name
                );
              }
            );

          let actual = 0;

          if (
            target.name ===
            "Fisik"
          ) {
            const meters =
              matched.reduce(
                (sum, item) => {
                  const distance =
                    Number(
                      item.distance_km
                    );

                  if (
                    !Number.isFinite(
                      distance
                    ) ||
                    distance <= 0
                  ) {
                    return sum;
                  }

                  return (
                    sum +
                    Math.round(
                      distance *
                        1000
                    )
                  );
                },
                0
              );

            actual =
              meters / 1000;
          } else {
            actual =
              matched.length;
          }

          const rawPercent =
            target.target > 0
              ? (
                  actual /
                  target.target
                ) * 100
              : 0;

          const capped =
            cappedPercent(
              actual,
              target.target
            );

          return {
            ...target,
            actual,
            percent:
              rawPercent,
            capped,
            achieved:
              actual >=
              target.target,
          };
        }
      );

    const overall =
      categories.length
        ? categories.reduce(
            (sum, item) =>
              sum +
              item.capped,
            0
          ) /
          categories.length
        : 0;

    return {
      categories,
      overall,

      achieved:
        categories.filter(
          (item) =>
            item.achieved
        ).length,

      verified:
        verified.length,

      pending:
        pending.length,

      total:
        rows.length,
    };
  }, [
    achievements,
    types,
    program,
    week,
  ]);

  // ====================================================
  // PROFIL PESERTA
  // ====================================================

  const participant =
    Array.isArray(
      program?.peserta
    )
      ? program.peserta[0]
      : program?.peserta;

  const participantName =
    participant?.full_name ||
    "Peserta OJT";

  // ====================================================
  // MENU
  // ====================================================

  const menus = [
    {
      title:
        "Monitoring OJT",
      icon: "📊",
      desc:
        "Seluruh kategori penilaian",
      route:
        `/monitoring/${programId}`,
    },
    {
      title:
        "Post-Test",
      icon: "📚",
      desc:
        `${postTests.length} nilai tercatat`,
      panel:
        "posttest",
    },
    {
      title:
        "Praktik Mingguan",
      icon: "🛠️",
      desc:
        `${practice.length} penilaian`,
      route:
        `/praktik/${programId}`,
    },
    {
      title:
        "Samapta",
      icon: "🏋️",
      desc:
        `${samapta.length} hasil tes`,
      route:
        `/samapta/${programId}`,
    },
    {
      title:
        "SIMPER",
      icon: "🪪",
      desc:
        simper
          ? "Data tersedia"
          : "Belum ada data",
      route:
        `/simper/${programId}`,
    },
    {
      title:
        "Evaluasi Mingguan",
      icon: "📅",
      desc:
        "Week Global 01–25",
      route:
        `/mingguan/${programId}`,
    },
    {
      title:
        "Grafik Perkembangan",
      icon: "📈",
      desc:
        "Analisis perkembangan",
      route:
        `/analisis/${programId}`,
    },
    {
      title:
        "Evaluasi Kesiapan",
      icon: "✅",
      desc:
        "Kelengkapan indikator",
      route:
        `/evaluasi/${programId}`,
    },
    {
      title:
        "Rapor OJT",
      icon: "📄",
      desc:
        "Laporan dan cetak PDF",
      route:
        `/laporan/${programId}`,
    },
  ];

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <main
        style={{
          padding: 30,
          fontFamily: "Arial",
        }}
      >
        <h2>OJT MineTrack</h2>
        <p>
          Memuat data peserta...
        </p>
      </main>
    );
  }

  if (
    !mentor ||
    !program
  ) {
    return (
      <main
        style={{
          padding: 30,
          fontFamily: "Arial",
        }}
      >
        <h2>
          Data Tidak Dapat
          Ditampilkan
        </h2>

        <p>
          {error ||
            "Akses tidak tersedia."}
        </p>

        <button
          type="button"
          onClick={() =>
            router.push("/")
          }
        >
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  // ====================================================
  // TAMPILAN HALAMAN
  // ====================================================

  return (
    <main className="mt-root">
      <style>{css}</style>

      {/* HEADER */}

      <header className="mt-header">
        <div className="mt-brand">
          OJT{" "}
          <span>
            MineTrack
          </span>
        </div>

        <div className="mt-header-right">
          <div className="mt-account">
            <span>
              {isAdmin
                ? "Administrator"
                : "Mentor OJT"}
            </span>

            <strong>
              {mentor.full_name ||
                "Pengelola OJT"}
            </strong>
          </div>

          <button
            type="button"
            className="mt-back"
            onClick={() =>
              panel ===
              "dashboard"
                ? router.push(
                    "/"
                  )
                : openPanel(
                    "dashboard"
                  )
            }
          >
            ←{" "}
            {panel ===
            "dashboard"
              ? "Dashboard"
              : "Menu Peserta"}
          </button>
        </div>
      </header>

      <div className="mt-container">

        {/* BANNER */}

        <section className="mt-banner">
          <small>
            EMERGENCY RESPONSE GROUP
            {" · "}
            PT BERAU COAL
          </small>

          <h1>
            Detail Peserta OJT
          </h1>

          <p>
            Monitoring Kompetensi
            dan Evaluasi OJT
          </p>
        </section>

        {/* PROFIL */}

        <section className="mt-card">
          <div className="mt-profile">
            <div className="mt-avatar">
              {initials(
                participantName
              )}
            </div>

            <div className="mt-profile-main">
              <div className="mt-profile-name">
                {participantName}
              </div>

              <div className="mt-profile-meta">
                {participant?.department ||
                  "—"}
                {" · "}
                {program.site ||
                  "Site belum diisi"}
              </div>
            </div>

            <span className="mt-status">
              {program.status ===
              "active"
                ? "Aktif"
                : program.status ||
                  "—"}
            </span>
          </div>

          <hr className="mt-divider" />

          <div className="mt-profile-details">
            <div>
              <span className="mt-info-label">
                Periode OJT
              </span>

              <div className="mt-info-value">
                {formatDate(
                  program.start_date
                )}
                {" – "}
                {formatDate(
                  program.end_date
                )}
              </div>
            </div>

            <div>
              <span className="mt-info-label">
                Akses Pengelola
              </span>

              <div className="mt-info-value">
                {isAdmin
                  ? "Administrator"
                  : isMentor
                  ? "Mentor"
                  : "—"}
                {" · "}
                {mentor.full_name ||
                  "—"}
              </div>
            </div>
          </div>
        </section>

        {/* NOTIFIKASI */}

        {error && (
          <div
            className="mt-alert error"
            role="alert"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="mt-alert success"
            role="status"
          >
            ✓ {message}
          </div>
        )}

        {/* DASHBOARD */}

        {panel ===
          "dashboard" && (
          <>

            {/* RINGKASAN ACHIEVEMENT */}

            <section className="mt-card">
              <div className="mt-section-head">
                <div>
                  <h2 className="mt-title">
                    Ringkasan Achievement
                    OJT
                  </h2>

                  <p className="mt-subtitle">
                    Ringkasan pencapaian
                    berdasarkan Kalender
                    Global Week 01–25.
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-refresh"
                  onClick={refresh}
                  disabled={
                    refreshing
                  }
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <div className="mt-section-head">
                <div>
                  <div className="mt-overall-label">
                    Progress Week{" "}
                    {String(
                      week
                    ).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <div className="mt-overall-note">
                    {weekStart &&
                    weekEnd
                      ? `${formatDate(
                          weekStart
                        )} – ${formatDate(
                          weekEnd
                        )}`
                      : "Periode belum tersedia"}
                  </div>

                  {selectedProgramRange && (
                    <div className="mt-week-active-range">
                      Periode peserta:
                      {" "}
                      {formatDate(
                        selectedProgramRange.start
                      )}
                      {" – "}
                      {formatDate(
                        selectedProgramRange.end
                      )}
                    </div>
                  )}
                </div>

                <select
                  className="mt-week-select"
                  aria-label="Pilih Minggu Global Achievement"
                  value={
                    availableWeeks.some(
                      (item) =>
                        item.week ===
                        week
                    )
                      ? week
                      : ""
                  }
                  onChange={(
                    event
                  ) =>
                    setWeek(
                      Number(
                        event.target.value
                      )
                    )
                  }
                >
                  {!availableWeeks.length && (
                    <option value="">
                      Tidak ada minggu
                    </option>
                  )}

                  {availableWeeks.map(
                    (item) => (
                      <option
                        key={
                          item.week
                        }
                        value={
                          item.week
                        }
                      >
                        Week{" "}
                        {String(
                          item.week
                        ).padStart(
                          2,
                          "0"
                        )}
                        {" · "}
                        {formatDate(
                          item.start
                        )}
                        {" – "}
                        {formatDate(
                          item.end
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              {availableWeeks.length ? (
                <>
                  <div className="mt-overall">
                    <div className="mt-overall-note">
                      Rata-rata pencapaian
                      enam kategori
                      terverifikasi pada
                      Week Global terpilih.
                    </div>

                    <div className="mt-overall-value">
                      {formatNumber(
                        weekly.overall,
                        2
                      )}
                      %
                    </div>
                  </div>

                  <ProgressBar
                    value={
                      weekly.overall
                    }
                  />

                  <div className="mt-stats">
                    <div className="mt-stat">
                      <small>
                        Kategori Tercapai
                      </small>

                      <strong>
                        {weekly.achieved}
                        /6
                      </strong>
                    </div>

                    <div className="mt-stat">
                      <small>
                        Terverifikasi
                      </small>

                      <strong>
                        {weekly.verified}
                      </strong>
                    </div>

                    <div className="mt-stat">
                      <small>
                        Menunggu
                      </small>

                      <strong>
                        {weekly.pending}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-category-head">
                    <h3>
                      Pencapaian 6 Kategori
                    </h3>

                    <small>
                      Target mingguan
                      tetap
                    </small>
                  </div>

                  <div className="mt-category-grid">
                    {weekly.categories.map(
                      (item) => (
                        <div
                          className="mt-category-card"
                          key={
                            item.name
                          }
                        >
                          <div className="mt-category-top">
                            <span>
                              {item.icon}
                              {" "}
                              {item.name}
                            </span>

                            <strong>
                              {formatNumber(
                                item.capped,
                                2
                              )}
                              %
                            </strong>
                          </div>

                          <ProgressBar
                            value={
                              item.capped
                            }
                          />

                          <div className="mt-category-bottom">
                            <span>
                              Realisasi:
                              {" "}
                              <strong>
                                {formatNumber(
                                  item.actual,
                                  item.name ===
                                    "Fisik"
                                    ? 3
                                    : 0
                                )}
                                {" "}
                                {item.unit}
                              </strong>
                            </span>

                            <span>
                              Target:
                              {" "}
                              {item.target}
                              {" "}
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <p className="mt-category-note">
                    Realisasi asli tidak
                    dibatasi. Persentase
                    setiap kategori
                    maksimal 100%.
                    Status Pending
                    tidak dihitung
                    sebagai pencapaian.
                  </p>
                </>
              ) : (
                <div className="mt-alert error">
                  Periode OJT peserta
                  tidak beririsan dengan
                  Kalender Global
                  Week 01–25.
                </div>
              )}
            </section>

            {/* ACHIEVEMENT MENU */}

            <section className="mt-card">
              <div className="mt-section-head">
                <div>
                  <h2 className="mt-title">
                    Achievement OJT
                  </h2>

                  <p className="mt-subtitle">
                    Input kegiatan
                    dan Monitoring
                    Achievement tersedia
                    pada halaman terpisah.
                  </p>
                </div>
              </div>

              <div className="mt-ach-navigation">
                <AchievementMenu
                  icon="📝"
                  title="Input Achievement"
                  description="Catat dan perbarui kegiatan peserta. Kegiatan baru langsung tersimpan sebagai Verified tanpa verifikasi manual."
                  detail="Input · Edit · Verified Otomatis"
                  onClick={() =>
                    router.push(
                      `/achievement/${programId}`
                    )
                  }
                />

                <AchievementMenu
                  icon="📊"
                  title="Monitoring Achievement"
                  description="Pantau enam kategori, target, grafik, dan riwayat kegiatan pada Kalender Global 25 minggu."
                  detail="Monitoring · Grafik · Riwayat"
                  variant="monitoring"
                  onClick={() =>
                    router.push(
                      `/achievement/${programId}/monitoring`
                    )
                  }
                />
              </div>
            </section>

            {/* MENU LAIN */}

            <section className="mt-card">
              <div className="mt-section-head">
                <h2 className="mt-title">
                  Monitoring & Penilaian
                </h2>
              </div>

              <div className="mt-menu-grid">
                {menus.map(
                  (item) => (
                    <button
                      key={
                        item.title
                      }
                      type="button"
                      className="mt-menu"
                      onClick={() =>
                        item.route
                          ? router.push(
                              item.route
                            )
                          : openPanel(
                              item.panel
                            )
                      }
                    >
                      <span className="mt-menu-icon">
                        {item.icon}
                      </span>

                      <div className="mt-menu-content">
                        <div className="mt-menu-name">
                          {item.title}
                        </div>

                        <div className="mt-menu-desc">
                          {item.desc}
                        </div>
                      </div>

                      <span className="mt-menu-arrow">
                        ›
                      </span>
                    </button>
                  )
                )}
              </div>
            </section>

            <button
              type="button"
              className="mt-bottom-back"
              onClick={() =>
                router.push("/")
              }
            >
              ← Kembali ke Dashboard
            </button>
          </>
        )}

        {/* POST TEST */}

        {panel ===
          "posttest" && (
          <>
            <section className="mt-card">
              <div className="mt-section-head">
                <h2 className="mt-title">
                  Monitoring Post-Test
                </h2>

                <button
                  type="button"
                  className="mt-button outline"
                  onClick={() =>
                    openPanel(
                      "dashboard"
                    )
                  }
                >
                  Kembali
                </button>
              </div>

              <div className="mt-stats mt-stats-two">
                <div className="mt-stat">
                  <small>
                    Total Post-Test
                  </small>

                  <strong>
                    {postTests.length}
                  </strong>
                </div>

                <div className="mt-stat">
                  <small>
                    Rata-rata Nilai
                  </small>

                  <strong>
                    {formatScore(
                      averageScores(
                        postTests
                      )
                    )}
                  </strong>
                </div>
              </div>

              <h3 className="mt-form-heading">
                {editTestId
                  ? "Edit Nilai Post-Test"
                  : "Input Nilai Post-Test"}
              </h3>

              <form onSubmit={saveTest}>
                <div className="mt-field-group">
                  <label htmlFor="mt-test-date">
                    Tanggal Pelaksanaan
                  </label>

                  <input
                    id="mt-test-date"
                    className="mt-field"
                    type="date"
                    value={
                      testDate
                    }
                    onChange={(
                      event
                    ) =>
                      setTestDate(
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="mt-field-group">
                  <label htmlFor="mt-test-score">
                    Nilai Post-Test
                    (0–100)
                  </label>

                  <input
                    id="mt-test-score"
                    className="mt-field"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      testScore
                    }
                    onChange={(
                      event
                    ) =>
                      setTestScore(
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="mt-field-group">
                  <label htmlFor="mt-test-notes">
                    Catatan Evaluasi
                  </label>

                  <textarea
                    id="mt-test-notes"
                    className="mt-field"
                    rows={3}
                    value={
                      testNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setTestNotes(
                        event.target.value
                      )
                    }
                    placeholder="Catatan evaluasi peserta..."
                  />
                </div>

                <div className="mt-actions">
                  <button
                    type="submit"
                    className="mt-button"
                    disabled={
                      savingTest ||
                      Boolean(
                        testActionId
                      )
                    }
                  >
                    {savingTest
                      ? "Menyimpan..."
                      : editTestId
                      ? "Simpan Perubahan Nilai"
                      : "Simpan Nilai Post-Test"}
                  </button>

                  {editTestId && (
                    <button
                      type="button"
                      className="mt-button gray"
                      onClick={resetTest}
                      disabled={
                        savingTest
                      }
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="mt-card">
              <h2 className="mt-title mt-history-heading">
                Riwayat Nilai
                Post-Test
              </h2>

              {!postTests.length && (
                <p className="mt-subtitle">
                  Belum ada nilai
                  Post-Test.
                </p>
              )}

              {postTests.map(
                (item) => (
                  <div
                    className="mt-history"
                    key={
                      item.id
                    }
                  >
                    <div className="mt-history-title">
                      Nilai:{" "}
                      {formatScore(
                        item.score
                      )}
                    </div>

                    <div className="mt-history-meta">
                      Tanggal:
                      {" "}
                      {formatDate(
                        item.test_date
                      )}

                      {" · "}
                      {globalWeekOf(
                        item.test_date
                      )
                        ? `Week ${String(
                            globalWeekOf(
                              item.test_date
                            )
                          ).padStart(
                            2,
                            "0"
                          )}`
                        : "Di luar Kalender Global"}
                    </div>

                    <p className="mt-history-desc">
                      {item.notes ||
                        "Tidak ada catatan."}
                    </p>

                    <div className="mt-history-actions">
                      <button
                        type="button"
                        className="mt-button blue"
                        disabled={
                          Boolean(
                            testActionId
                          ) ||
                          savingTest
                        }
                        onClick={() =>
                          editTest(
                            item
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="mt-button red"
                        disabled={
                          Boolean(
                            testActionId
                          ) ||
                          savingTest
                        }
                        onClick={() =>
                          deleteTest(
                            item
                          )
                        }
                      >
                        {testActionId ===
                        item.id
                          ? "Menghapus..."
                          : "Hapus"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </section>
          </>
        )}

        <footer className="mt-footer">
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

// ======================================================
// CSS - MEMPERTAHANKAN GAYA HALAMAN LAMA
// DENGAN TAMBAHAN REKAP KATEGORI GLOBAL
// ======================================================

const css = `
.mt-root {
  min-height: 100vh;
  background: #f1f6f5;
  color: #172e2a;
  font-family: Arial, Helvetica, sans-serif;
}

.mt-root * {
  box-sizing: border-box;
}

.mt-header {
  background: #071e25;
  color: white;
  padding: 17px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.mt-brand {
  font-size: 21px;
  font-weight: 900;
}

.mt-brand span {
  color: #27c991;
}

.mt-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mt-account {
  text-align: right;
}

.mt-account span,
.mt-account strong {
  display: block;
}

.mt-account span {
  font-size: 10px;
  color: #bad5ca;
}

.mt-account strong {
  font-size: 12px;
  margin-top: 4px;
  color: white;
  overflow-wrap: anywhere;
}

.mt-back {
  background: #ffffff18;
  border: 1px solid #ffffff30;
  border-radius: 10px;
  color: white;
  padding: 10px 14px;
  font-weight: 800;
  cursor: pointer;
}

.mt-container {
  max-width: 1200px;
  margin: auto;
  padding: 22px;
}

.mt-banner {
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
  padding: 28px;
  color: white;
  margin-bottom: 16px;
}

.mt-banner small {
  color: #e7bd69;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
}

.mt-banner h1 {
  font-size: 28px;
  margin: 12px 0 8px;
}

.mt-banner p {
  color: #d5e9e0;
  font-size: 12px;
  margin: 0;
}

.mt-card {
  background: white;
  border: 1px solid #e3ebea;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 5px 18px #102e2710;
}

.mt-profile {
  display: flex;
  align-items: center;
  gap: 14px;
}

.mt-avatar {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 16px;
  background: #e1f7ea;
  color: #098861;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
}

.mt-profile-main {
  flex: 1;
  min-width: 0;
}

.mt-profile-name {
  font-size: 19px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.mt-profile-meta {
  font-size: 12px;
  color: #71857b;
  margin-top: 6px;
  line-height: 1.6;
}

.mt-status {
  background: #dff6e9;
  color: #09784d;
  padding: 7px 10px;
  border-radius: 30px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.mt-divider {
  border: 0;
  border-top: 1px solid #e9efeb;
  margin: 17px 0;
}

.mt-profile-details {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap: 12px;
}

.mt-info-label {
  display: block;
  color: #819188;
  font-size: 11px;
  margin-bottom: 6px;
}

.mt-info-value {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
}

.mt-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.mt-title {
  font-size: 18px;
  font-weight: 900;
  color: #17352b;
  margin: 0;
}

.mt-subtitle {
  font-size: 12px;
  color: #819188;
  line-height: 1.6;
  margin: 7px 0 0;
}

.mt-refresh {
  border: 0;
  border-radius: 9px;
  background: #e8f6ed;
  color: #08784d;
  padding: 10px 12px;
  font-weight: 800;
  cursor: pointer;
}

.mt-refresh:disabled {
  opacity: .6;
}

.mt-overall {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.mt-overall-label {
  font-size: 14px;
  font-weight: 900;
}

.mt-overall-note {
  color: #819188;
  font-size: 11px;
  margin-top: 7px;
  line-height: 1.5;
}

.mt-overall-value {
  font-size: 34px;
  color: #087d59;
  font-weight: 900;
  white-space: nowrap;
}

.mt-progress {
  width: 100%;
  height: 9px;
  background: #e5eeea;
  border-radius: 30px;
  overflow: hidden;
}

.mt-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #25bc87,
    #0c815c
  );
  transition: width .2s;
}

.mt-stats {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 10px;
  margin-top: 17px;
}

.mt-stats-two {
  grid-template-columns:
    repeat(2,minmax(0,1fr));
}

.mt-stat {
  background: #f7faf8;
  border: 1px solid #eaf0eb;
  border-radius: 11px;
  padding: 12px 7px;
  text-align: center;
  min-width: 0;
}

.mt-stat small {
  display: block;
  color: #71877b;
  font-size: 11px;
  line-height: 1.5;
}

.mt-stat strong {
  display: block;
  color: #193e30;
  font-size: 21px;
  font-weight: 900;
  margin-top: 7px;
}

.mt-week-select {
  border: 1px solid #c8e7d6;
  border-radius: 10px;
  background: #eaf8f0;
  color: #08784f;
  padding: 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  max-width: 100%;
}

.mt-week-active-range {
  display: inline-block;
  margin-top: 7px;
  padding: 6px 9px;
  border-radius: 7px;
  background: #f0f8f2;
  color: #327955;
  font-size: 11px;
}

.mt-category-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 21px;
  margin-bottom: 12px;
}

.mt-category-head h3 {
  font-size: 14px;
  font-weight: 900;
  margin: 0;
}

.mt-category-head small {
  color: #789185;
}

.mt-category-grid {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap: 10px;
}

.mt-category-card {
  padding: 14px;
  background: #fbfefd;
  border: 1px solid #e3ece6;
  border-radius: 12px;
  min-width: 0;
}

.mt-category-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 11px;
}

.mt-category-top span {
  font-size: 12px;
  font-weight: 800;
}

.mt-category-top strong {
  font-size: 14px;
  color: #087d59;
}

.mt-category-bottom {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 11px;
  color: #75887d;
  font-size: 11px;
}

.mt-category-bottom strong {
  color: #23483a;
}

.mt-category-note {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #789185;
}

.mt-ach-navigation {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap: 14px;
}

.mt-ach-menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  border: 1px solid #dcebe3;
  border-radius: 15px;
  padding: 22px;
  background: #fbfefd;
  color: #193b30;
  cursor: pointer;
  min-width: 0;
  min-height: 192px;
}

.mt-ach-menu:hover {
  border-color: #37b988;
  box-shadow: 0 6px 20px #08784d12;
  transform: translateY(-1px);
}

.mt-ach-menu.monitoring {
  background: #f5fafc;
  border-color: #dce8ed;
}

.mt-ach-menu-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mt-ach-menu-icon {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: #e0f6e9;
  font-size: 24px;
}

.mt-ach-menu.monitoring
.mt-ach-menu-icon {
  background: #e1eef7;
}

.mt-ach-menu-arrow {
  font-size: 22px;
  color: #0c8760;
}

.mt-ach-menu h3 {
  font-size: 17px;
  font-weight: 900;
  margin: 4px 0 0;
}

.mt-ach-menu p {
  color: #788e81;
  font-size: 12px;
  line-height: 1.7;
  margin: 0;
  flex: 1;
}

.mt-ach-menu-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 13px;
  border-top: 1px solid #e6eee9;
}

.mt-ach-menu-bottom span {
  color: #759184;
  font-size: 11px;
}

.mt-ach-menu-bottom strong {
  color: #07855b;
  font-size: 11px;
}

.mt-menu-grid {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap: 10px;
}

.mt-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 76px;
  border: 1px solid #e3ebe7;
  border-radius: 12px;
  background: white;
  padding: 12px;
  text-align: left;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

.mt-menu:hover {
  background: #f7fcf9;
  border-color: #9ed7bd;
}

.mt-menu-icon {
  font-size: 23px;
  flex-shrink: 0;
}

.mt-menu-content {
  flex: 1;
  min-width: 0;
}

.mt-menu-name {
  font-size: 12px;
  font-weight: 900;
  line-height: 1.4;
}

.mt-menu-desc {
  color: #809389;
  font-size: 10px;
  margin-top: 5px;
  line-height: 1.4;
}

.mt-menu-arrow {
  color: #82968a;
  font-size: 20px;
}

.mt-button {
  border: 0;
  background: #118660;
  color: white;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.mt-button:disabled {
  opacity: .55;
}

.mt-button.outline {
  background: #ecf5f0;
  color: #167251;
}

.mt-button.gray {
  background: #64748b;
}

.mt-button.blue {
  background: #317bd0;
}

.mt-button.red {
  background: #d03939;
}

.mt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mt-form-heading {
  margin: 24px 0 17px;
  font-size: 18px;
}

.mt-field-group {
  margin-bottom: 17px;
}

.mt-field-group label {
  display: block;
  color: #344a40;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 7px;
}

.mt-field {
  width: 100%;
  background: white;
  border: 1px solid #d8e3dd;
  border-radius: 10px;
  color: #17352b;
  padding: 12px;
  font-size: 16px;
  font-family: inherit;
}

textarea.mt-field {
  resize: vertical;
}

.mt-history {
  border: 1px solid #e1eae5;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 11px;
}

.mt-history-heading {
  margin-bottom: 16px;
}

.mt-history-title {
  font-size: 14px;
  font-weight: 900;
}

.mt-history-meta {
  color: #788980;
  font-size: 11px;
  margin-top: 6px;
  line-height: 1.6;
}

.mt-history-desc {
  color: #395045;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.mt-history-actions {
  display: flex;
  gap: 7px;
  margin-top: 12px;
}

.mt-alert {
  padding: 14px;
  border-radius: 11px;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 15px;
}

.mt-alert.error {
  background: #fff0f1;
  border: 1px solid #fecdd3;
  color: #b91c1c;
}

.mt-alert.success {
  background: #edfbf2;
  border: 1px solid #bde7ca;
  color: #08784d;
}

.mt-bottom-back {
  width: 100%;
  border: 1px solid #cfe2d9;
  background: #eaf2ef;
  color: #234139;
  border-radius: 12px;
  padding: 15px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  margin-top: 15px;
}

.mt-footer {
  text-align: center;
  color: #8b9f93;
  font-size: 11px;
  padding: 22px 0;
}

@media (min-width: 900px) {
  .mt-menu-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }
}

@media (max-width: 760px) {
  .mt-header {
    padding: 15px;
  }

  .mt-brand {
    font-size: 18px;
  }

  .mt-account {
    display: none;
  }

  .mt-back {
    font-size: 12px;
    padding: 9px;
  }

  .mt-container {
    padding: 12px;
  }

  .mt-banner {
    padding: 23px 18px;
  }

  .mt-banner h1 {
    font-size: 24px;
  }

  .mt-card {
    padding: 15px;
    margin-bottom: 12px;
  }

  .mt-avatar {
    width: 48px;
    height: 48px;
    font-size: 17px;
  }

  .mt-profile {
    gap: 10px;
  }

  .mt-profile-name {
    font-size: 16px;
  }

  .mt-profile-meta {
    font-size: 11px;
  }

  .mt-overall-value {
    font-size: 29px;
  }

  .mt-ach-navigation {
    gap: 9px;
  }

  .mt-ach-menu {
    padding: 14px;
    min-height: 195px;
  }

  .mt-ach-menu-icon {
    width: 42px;
    height: 42px;
    font-size: 21px;
  }

  .mt-ach-menu h3 {
    font-size: 14px;
  }

  .mt-ach-menu p {
    font-size: 11px;
  }

  .mt-menu-grid {
    gap: 9px;
  }

  .mt-menu {
    padding: 10px;
    gap: 8px;
  }

  .mt-menu-icon {
    font-size: 20px;
  }

  .mt-menu-name {
    font-size: 11px;
  }

  .mt-stat strong {
    font-size: 18px;
  }

  .mt-category-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .mt-ach-navigation {
    grid-template-columns: 1fr;
  }

  .mt-ach-menu {
    min-height: 155px;
  }

  .mt-profile {
    flex-wrap: wrap;
  }
}
`;
