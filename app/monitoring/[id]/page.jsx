
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const MENUS = [
  {
    name: "Fisik",
    icon: "🏃",
    desc: "Jarak lari dan riwayat kegiatan",
    path: "fisik",
    target: "25 km/minggu",
  },
  {
    name: "Samapta",
    icon: "🏋️",
    desc: "Hasil tes kesamaptaan",
    path: "samapta",
    target: "3 periode tes",
  },
  {
    name: "Internal Training",
    icon: "🎓",
    desc: "Pelatihan dan materi",
    path: "training",
    target: "4 kegiatan/minggu",
  },
  {
    name: "Coaching",
    icon: "👥",
    desc: "Pembinaan oleh mentor",
    path: "coaching",
    target: "1 kegiatan/minggu",
  },
  {
    name: "Sosialisasi",
    icon: "📣",
    desc: "Riwayat kegiatan sosialisasi",
    path: "sosialisasi",
    target: "3 kegiatan/minggu",
  },
  {
    name: "Orientasi Area",
    icon: "🗺️",
    desc: "Pengenalan area kerja",
    path: "orientasi-area",
    target: "2 kegiatan/minggu",
  },
  {
    name: "Hazard",
    icon: "⚠️",
    desc: "Identifikasi bahaya",
    path: "hazard",
    target: "2 kegiatan/minggu",
  },
  {
    name: "Teori",
    icon: "📚",
    desc: "Nilai pembelajaran",
    path: "teori",
    target: "Sesuai jadwal",
  },
  {
    name: "Praktik",
    icon: "📝",
    desc: "Nilai praktik mingguan",
    path: "praktik",
    target: "Sesuai jadwal",
  },
  {
    name: "SIMPER",
    icon: "🪪",
    desc: "Status dan validasi SIMPER",
    path: "simper",
    target: "Validasi tahapan",
  },
];

export default function MonitoringPage() {
  const router = useRouter();
  const params = useParams();

  const id = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [program, setProgram] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const userId = auth.user.id;

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        const role = String(
          profile?.role || ""
        ).trim().toLowerCase();

        const isAdmin = role === "admin";
        const isMentor = role === "mentor";

        const isParticipant = [
          "participant",
          "peserta",
        ].includes(role);

        if (!isAdmin && !isMentor && !isParticipant) {
          throw new Error(
            "Akun tidak memiliki akses monitoring."
          );
        }

        let query = supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            mentor_id,
            site,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", id);

        // Admin dapat mengakses seluruh program.
        // Mentor hanya peserta binaannya.
        // Peserta hanya program miliknya sendiri.

        if (isMentor) {
          query = query.eq("mentor_id", userId);
        }

        if (isParticipant) {
          query = query.eq("participant_id", userId);
        }

        const { data, error: queryError } =
          await query.maybeSingle();

        if (queryError) throw queryError;

        if (!data) {
          throw new Error(
            "Program OJT tidak ditemukan atau Anda tidak memiliki akses."
          );
        }

        if (active) {
          setProgram(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memuat monitoring."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (id) {
      load();
    } else {
      setError("ID program tidak ditemukan.");
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [id, router]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  function openMenu(menu) {
    if (!id || !menu?.path || !program) {
      return;
    }

    const destination =
      `/monitoring/${encodeURIComponent(id)}/${menu.path}`;

    router.push(destination);
  }

  return (
    <main className="mt-root">
      <style>{`
        .mt-root {
          min-height: 100vh;
          background: #f0f5f4;
          color: #163145;
          font-family: Arial, Helvetica, sans-serif;
        }

        .mt-root * {
          box-sizing: border-box;
        }

        .mt-header {
          background: #07313a;
          color: white;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .mt-brand {
          font-size: 23px;
          font-weight: 900;
        }

        .mt-brand span {
          color: #3bc78e;
        }

        .mt-back {
          background: #e1f2e9;
          color: #0a694d;
          border: 0;
          border-radius: 9px;
          padding: 11px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .mt-container {
          max-width: 1100px;
          margin: auto;
          padding: 20px;
        }

        .mt-title {
          font-size: 25px;
          margin: 0 0 8px;
        }

        .mt-subtitle {
          color: #71818b;
          line-height: 1.5;
          margin-bottom: 18px;
        }

        .mt-profile {
          background: white;
          border: 1px solid #d8e4e7;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 10px;
        }

        .mt-profile strong {
          font-size: 18px;
        }

        .mt-profile p {
          margin: 6px 0 0;
          color: #71818b;
        }

        .mt-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .mt-card {
          text-align: left;
          background: white;
          border: 1px solid #d8e4e7;
          border-radius: 15px;
          padding: 17px;
          cursor: pointer;
          color: #173249;
          transition:
            transform .15s,
            border-color .15s;
        }

        .mt-card:hover {
          transform: translateY(-2px);
          border-color: #1d9467;
        }

        .mt-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 15px;
        }

        .mt-icon {
          background: #e6f5ed;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 25px;
        }

        .mt-arrow {
          font-size: 22px;
          color: #7e909b;
        }

        .mt-name {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .mt-desc {
          color: #73848f;
          font-size: 12px;
          line-height: 1.4;
          min-height: 34px;
        }

        .mt-target {
          display: inline-block;
          background: #e8f6ee;
          color: #0b7852;
          border-radius: 7px;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 800;
          margin-top: 12px;
        }

        .mt-error {
          background: #fff0f0;
          border: 1px solid #f2b9b9;
          border-radius: 9px;
          color: #a32635;
          padding: 14px;
        }

        @media (max-width: 760px) {
          .mt-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .mt-container {
            padding: 12px;
          }

          .mt-card {
            padding: 12px;
          }

          .mt-icon {
            width: 42px;
            height: 42px;
          }

          .mt-name {
            font-size: 14px;
          }

          .mt-title {
            font-size: 21px;
          }

          .mt-brand {
            font-size: 19px;
          }
        }
      `}</style>

      <header className="mt-header">
        <div className="mt-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="mt-back"
          onClick={() =>
            router.push(`/peserta/${id}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="mt-container">
        <h1 className="mt-title">
          Monitoring Penilaian OJT
        </h1>

        <p className="mt-subtitle">
          Pilih kategori untuk melihat pencapaian
          dan riwayat kegiatan peserta.
        </p>

        {loading ? (
          <p>Memuat data peserta...</p>
        ) : error ? (
          <div className="mt-error">
            {error}
          </div>
        ) : (
          <>
            <section className="mt-profile">
              <div>
                <strong>
                  {peserta?.full_name ||
                    "Peserta OJT"}
                </strong>

                <p>
                  Departemen:{" "}
                  {peserta?.department || "—"}
                </p>
              </div>

              <div>
                <strong>
                  {program?.site || "—"}
                </strong>

                <p>Site OJT</p>
              </div>
            </section>

            <div className="mt-grid">
              {MENUS.map((menu) => (
                <button
                  type="button"
                  key={menu.path}
                  className="mt-card"
                  onClick={() => openMenu(menu)}
                >
                  <div className="mt-card-top">
                    <span className="mt-icon">
                      {menu.icon}
                    </span>

                    <span className="mt-arrow">
                      ›
                    </span>
                  </div>

                  <div className="mt-name">
                    {menu.name}
                  </div>

                  <div className="mt-desc">
                    {menu.desc}
                  </div>

                  <div className="mt-target">
                    {menu.target}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
