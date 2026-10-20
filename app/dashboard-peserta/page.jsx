
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const card = {
  background: "white",
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  marginBottom: 16,
};

const button = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "14px 16px",
  fontWeight: 700,
  width: "100%",
  cursor: "pointer",
  marginBottom: 10,
};

export default function DashboardPeserta() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: p, error: pError } =
          await supabase
            .from("profiles")
            .select("id,full_name,department,role")
            .eq("id", user.id)
            .single();

        if (pError) throw pError;

        if (p.role === "mentor") {
          router.replace("/");
          return;
        }

        if (p.role !== "participant") {
          throw new Error(
            "Akun tidak memiliki akses peserta."
          );
        }

        const { data: programs, error: programError } =
          await supabase
            .from("ojt_programs")
            .select(
              "id,participant_id,start_date,end_date,status"
            )
            .eq("participant_id", user.id)
            .eq("status", "active")
            .order("start_date", {
              ascending: false,
            })
            .limit(1);

        if (programError) throw programError;

        if (active) {
          setProfile(p);
          setProgram(programs?.[0] || null);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat data."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 18,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...card,
            background: "#0f172a",
            color: "white",
          }}
        >
          <h1>Dashboard Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
        </header>

        {loading && (
          <section style={card}>
            Memuat data peserta...
          </section>
        )}

        {error && (
          <section style={card}>
            <p style={{ color: "#dc2626" }}>
              {error}
            </p>
          </section>
        )}

        {!loading && profile && (
          <>
            <section style={card}>
              <h2>
                {profile.full_name ||
                  "Peserta OJT"}
              </h2>

              <p>
                Departemen:{" "}
                {profile.department || "-"}
              </p>

              <p>
                Status Program:{" "}
                {program?.status ||
                  "Belum ada program aktif"}
              </p>

              {program && (
                <p>
                  Periode:{" "}
                  {program.start_date} sampai{" "}
                  {program.end_date}
                </p>
              )}
            </section>

            {program ? (
              <section style={card}>
                <h2>Monitoring Saya</h2>

                <p>
                  Pilih menu untuk melihat
                  perkembangan OJT Anda.
                </p>

                <button
                  style={button}
                  onClick={() =>
                    router.push(
                      `/analisis/${program.id}`
                    )
                  }
                >
                  📊 Grafik Perkembangan OJT
                </button>

                <button
                  style={{
                    ...button,
                    background: "#16a34a",
                  }}
                  onClick={() =>
                    router.push(
                      `/evaluasi/${program.id}`
                    )
                  }
                >
                  ✓ Evaluasi Kesiapan OJT
                </button>

                <button
                  style={{
                    ...button,
                    background: "#7c3aed",
                  }}
                  onClick={() =>
                    router.push(
                      `/laporan/${program.id}`
                    )
                  }
                >
                  📄 Laporan OJT Saya
                </button>
              </section>
            ) : (
              <section style={card}>
                Belum ada program OJT aktif
                yang terhubung dengan akun ini.
              </section>
            )}

            <button
              style={{
                ...button,
                background: "#475569",
              }}
              onClick={logout}
            >
              Keluar
            </button>
          </>
        )}
      </div>
    </main>
  );
}
