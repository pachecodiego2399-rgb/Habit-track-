"use client";

/**
 * Dashboard de hábitos — Reto de 6 meses (180 días) / 4 áreas de vida
 * ------------------------------------------------------------------
 * Construido a partir del prompt de diseño acordado: estética oscura
 * tipo "terminal / casa de apuestas", 4 áreas (Mental, Espiritual,
 * Física, Económica), gráfico de progreso con gradiente, panel de
 * retroalimentación semanal/mensual por reglas, y grilla de hábitos
 * agrupada por semanas dentro de cada uno de los 6 meses.
 *
 * Es un proyecto separado del habit-tracker-90-dias.jsx (90 días /
 * 7 áreas) — no lo reemplaza ni depende de él.
 *
 * Requisitos:
 *  - Tailwind CSS configurado (stack Next.js / Vercel).
 *  - Componente de cliente ("use client"), usa hooks.
 *  - Sin dependencias externas: gráfico en SVG puro, ícono de racha
 *    es el emoji 🔥.
 *
 * Persistencia:
 *  - El PROGRESO (qué días quedaron marcados) vive en Airtable, vía las
 *    rutas /api/progress (ver app/api/progress/route.js) — así se ve
 *    igual desde cualquier navegador o dispositivo.
 *  - Los HÁBITOS y la fecha de inicio siguen en localStorage (clave
 *    STORAGE_KEY) por ahora: son locales a este navegador. Si agregas
 *    o borras un hábito desde el botón "+ Hábito", ese cambio no se
 *    sincroniza a Airtable todavía — solo se guardan las marcas de los
 *    6 hábitos originales que sí existen en la base.
 * ------------------------------------------------------------------
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const STORAGE_KEY = "dashboard-habitos-6-meses:v1";
const TOTAL_DAYS = 180;
const MONTH_LEN = 30; // 6 meses x 30 días = 180
const MONTH_COUNT = TOTAL_DAYS / MONTH_LEN;

const AREAS = {
  mental: { label: "Mental", color: "#7C5CFF" },
  espiritual: { label: "Espiritual", color: "#00E5D6" },
  fisica: { label: "Física", color: "#FF4D4D" },
  estetica: { label: "Estética", color: "#FF3DA6" },
  economica: { label: "Económica", color: "#FFA31A" },
};

const AREA_ORDER = ["mental", "espiritual", "fisica", "estetica", "economica"];

const GRADIENT_STOPS = [
  { offset: "0%", color: "#7C5CFF" }, // violeta — mental
  { offset: "33%", color: "#00E5D6" }, // cian — espiritual
  { offset: "66%", color: "#FFA31A" }, // ámbar — económica
  { offset: "100%", color: "#FF4D4D" }, // coral — física
];

const DEFAULT_HABITS = [
  { id: "h1", name: "Levantarme 5am", area: "mental" },
  { id: "h2", name: "Tiempo con Dios", area: "espiritual" },
  { id: "h3", name: "Round 1", area: "fisica" },
  { id: "h5", name: "Train Neck", area: "estetica" },
  { id: "h7", name: "Skincare", area: "estetica" },
  { id: "h6", name: "Negocio", area: "economica" },
  { id: "h4", name: "Round 2", area: "fisica" },
  { id: "h8", name: "3L agua", area: "fisica" },
  { id: "h9", name: "4000 calorias", area: "fisica" },
];

const DEFAULT_START_DATE = "2026-08-07";

// ---------------------------------------------------------------------------
// Helpers de fecha
// ---------------------------------------------------------------------------

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dateFromDay(startDateISO, dayNumber) {
  const start = new Date(`${startDateISO}T00:00:00`);
  const d = new Date(start);
  d.setDate(d.getDate() + (dayNumber - 1));
  return d;
}

function formatShort(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function computeCurrentDay(startDateISO) {
  const start = new Date(`${startDateISO}T00:00:00`);
  const now = new Date();
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((nowMid - startMid) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), TOTAL_DAYS);
}

function getStreak(habitId, completions, currentDay) {
  const map = completions[habitId] || {};
  let day = map[currentDay] ? currentDay : currentDay - 1;
  let streak = 0;
  while (day >= 1 && map[day]) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

function uid() {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pctFor(habits, completions, days) {
  const totalSlots = habits.length * days.length;
  if (!totalSlots) return null;
  let done = 0;
  for (const h of habits) {
    for (const day of days) {
      if (completions[h.id]?.[day]) done += 1;
    }
  }
  return Math.round((done / totalSlots) * 100);
}

function rangeDays(start, end) {
  const clampedStart = Math.max(start, 1);
  const clampedEnd = Math.min(end, TOTAL_DAYS);
  if (clampedStart > clampedEnd) return [];
  const out = [];
  for (let d = clampedStart; d <= clampedEnd; d += 1) out.push(d);
  return out;
}

function feedbackMessage(pct) {
  if (pct === null) return "Todavía no hay datos para este período.";
  if (pct >= 85) return "Estás dominando el reto. Sigue así.";
  if (pct >= 60) return "Vas bien, no aflojes esta semana.";
  if (pct >= 35) return "Nivel irregular. Elige 1 hábito para enfocarte.";
  return "Semana difícil. Reengánchate mañana, no hoy.";
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DashboardHabitos6Meses() {
  const [habits, setHabits] = useState(DEFAULT_HABITS);
  // { [habitId]: { [day]: airtableRecordId } } — el valor es el ID del registro en
  // Airtable para poder borrarlo al desmarcar. "pending" mientras se está guardando.
  const [completions, setCompletions] = useState({});
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [progressError, setProgressError] = useState(null);
  const [activeArea, setActiveArea] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [monthTouched, setMonthTouched] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitArea, setNewHabitArea] = useState("mental");

  // ---- Cargar hábitos / fecha de inicio (local, por navegador) ----------
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.habits) && parsed.habits.length > 0) {
          let migratedHabits = parsed.habits;
          const hasOldCombinedHabit = migratedHabits.some((h) => h.id === "h5" && h.name === "Cuello y hielo");
          const hasSkincare = migratedHabits.some((h) => h.id === "h7");
          if (hasOldCombinedHabit && !hasSkincare) {
            migratedHabits = migratedHabits.flatMap((h) => {
              if (h.id === "h5" && h.name === "Cuello y hielo") {
                return [
                  { id: "h5", name: "Train Neck", area: "estetica" },
                  { id: "h7", name: "Skincare", area: "estetica" },
                ];
              }
              return [h];
            });
          }
          const hasAgua = migratedHabits.some((h) => h.id === "h8");
          const hasCalorias = migratedHabits.some((h) => h.id === "h9");
          if (!hasAgua) {
            migratedHabits = [...migratedHabits, { id: "h8", name: "3L agua", area: "fisica" }];
          }
          if (!hasCalorias) {
            migratedHabits = [...migratedHabits, { id: "h9", name: "4000 calorias", area: "fisica" }];
          }
          setHabits(migratedHabits);
        }
        if (parsed.startDate) setStartDate(parsed.startDate);
      }
    } catch (err) {
      console.error("No se pudo cargar la configuración guardada:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  // ---- Guardar hábitos / fecha de inicio automáticamente -----------------
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ habits, startDate })
      );
    } catch (err) {
      console.error("No se pudo guardar la configuración:", err);
    }
  }, [habits, startDate, hydrated]);

  // ---- Cargar el progreso (marcas) desde Airtable ------------------------
  useEffect(() => {
    let cancelled = false;
    fetch("/api/progress")
      .then((res) => {
        if (!res.ok) throw new Error(`Airtable respondió ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const next = {};
        for (const entry of data.entries || []) {
          if (!next[entry.habitId]) next[entry.habitId] = {};
          next[entry.habitId][entry.day] = entry.recordId;
        }
        setCompletions(next);
      })
      .catch((err) => {
        console.error("No se pudo cargar el progreso desde Airtable:", err);
        if (!cancelled) setProgressError("No se pudo cargar tu progreso desde Airtable.");
      })
      .finally(() => {
        if (!cancelled) setProgressLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentDay = useMemo(() => computeCurrentDay(startDate), [startDate]);
  const currentMonth = useMemo(
    () => Math.min(Math.ceil(currentDay / MONTH_LEN), MONTH_COUNT),
    [currentDay]
  );

  // Si el usuario no tocó manualmente el selector de mes, seguimos el mes actual
  useEffect(() => {
    if (!monthTouched) setSelectedMonth(currentMonth);
  }, [currentMonth, monthTouched]);

  const filteredHabits = useMemo(
    () => (activeArea === "all" ? habits : habits.filter((h) => h.area === activeArea)),
    [habits, activeArea]
  );

  // ---- Estadísticas del mes seleccionado (para el gráfico) -------------
  const monthDays = useMemo(() => {
    const start = (selectedMonth - 1) * MONTH_LEN + 1;
    const end = selectedMonth * MONTH_LEN;
    return Array.from({ length: MONTH_LEN }, (_, i) => start + i).filter((d) => d <= end);
  }, [selectedMonth]);

  const monthDailyStats = useMemo(() => {
    const total = habits.length || 1;
    return monthDays
      .filter((day) => day <= currentDay)
      .map((day) => {
        let done = 0;
        for (const h of habits) {
          if (completions[h.id]?.[day]) done += 1;
        }
        return { day, pct: Math.round((done / total) * 100) };
      });
  }, [monthDays, habits, completions, currentDay]);

  // ---- Retroalimentación semanal / mensual ------------------------------
  const weekStats = useMemo(() => {
    const curDays = rangeDays(currentDay - 6, currentDay);
    const prevDays = rangeDays(currentDay - 13, currentDay - 7);
    const pct = pctFor(habits, completions, curDays);
    const prevPct = pctFor(habits, completions, prevDays);
    return { pct, prevPct, delta: pct !== null && prevPct !== null ? pct - prevPct : null };
  }, [habits, completions, currentDay]);

  const monthStats = useMemo(() => {
    const monthStart = (currentMonth - 1) * MONTH_LEN + 1;
    const curDays = rangeDays(monthStart, currentDay);
    const pct = pctFor(habits, completions, curDays);
    let prevPct = null;
    if (currentMonth > 1) {
      const prevStart = (currentMonth - 2) * MONTH_LEN + 1;
      const prevEnd = (currentMonth - 1) * MONTH_LEN;
      prevPct = pctFor(habits, completions, rangeDays(prevStart, prevEnd));
    }
    return { pct, prevPct, delta: pct !== null && prevPct !== null ? pct - prevPct : null };
  }, [habits, completions, currentDay, currentMonth]);

  const overallPct = useMemo(() => pctFor(habits, completions, rangeDays(1, currentDay)), [
    habits,
    completions,
    currentDay,
  ]);

  // ---- Acciones ------------------------------------------------------
  const toggleDay = useCallback(
    async (habitId, day) => {
      if (day > currentDay) return;
      const existingRecordId = completions[habitId]?.[day];
      const isRealRecord = existingRecordId && existingRecordId !== "pending";

      if (isRealRecord) {
        // Desmarcar: quitar de inmediato en la UI, luego borrar en Airtable.
        setCompletions((prev) => {
          const habitMap = { ...(prev[habitId] || {}) };
          delete habitMap[day];
          return { ...prev, [habitId]: habitMap };
        });
        try {
          const res = await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ habitId, day, completed: false, recordId: existingRecordId }),
          });
          if (!res.ok) throw new Error(`Airtable respondió ${res.status}`);
        } catch (err) {
          console.error("No se pudo desmarcar en Airtable:", err);
          setProgressError("No se pudo guardar ese cambio en Airtable. Intenta de nuevo.");
          // revertir
          setCompletions((prev) => ({
            ...prev,
            [habitId]: { ...(prev[habitId] || {}), [day]: existingRecordId },
          }));
        }
        return;
      }

      if (existingRecordId === "pending") return; // ya se está guardando

      // Marcar: mostrar de inmediato, luego confirmar con Airtable.
      setCompletions((prev) => ({
        ...prev,
        [habitId]: { ...(prev[habitId] || {}), [day]: "pending" },
      }));
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habitId, day, completed: true, startDate }),
        });
        if (!res.ok) throw new Error(`Airtable respondió ${res.status}`);
        const data = await res.json();
        setCompletions((prev) => ({
          ...prev,
          [habitId]: { ...(prev[habitId] || {}), [day]: data.recordId },
        }));
      } catch (err) {
        console.error("No se pudo marcar en Airtable:", err);
        setProgressError("No se pudo guardar ese cambio en Airtable. Intenta de nuevo.");
        setCompletions((prev) => {
          const habitMap = { ...(prev[habitId] || {}) };
          delete habitMap[day];
          return { ...prev, [habitId]: habitMap };
        });
      }
    },
    [currentDay, completions, startDate]
  );

  const addHabit = useCallback(() => {
    const name = newHabitName.trim();
    if (!name) return;
    setHabits((prev) => [...prev, { id: uid(), name, area: newHabitArea }]);
    setNewHabitName("");
  }, [newHabitName, newHabitArea]);

  const removeHabit = useCallback((habitId) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    setCompletions((prev) => {
      const next = { ...prev };
      delete next[habitId];
      return next;
    });
  }, []);

  const resetProgress = useCallback(async () => {
    setConfirmReset(false);
    setShowSettingsModal(false);
    const previous = completions;
    setCompletions({});
    try {
      const res = await fetch("/api/progress", { method: "DELETE" });
      if (!res.ok) throw new Error(`Airtable respondió ${res.status}`);
    } catch (err) {
      console.error("No se pudo reiniciar el progreso en Airtable:", err);
      setProgressError("No se pudo reiniciar el progreso en Airtable.");
      setCompletions(previous);
    }
  }, [completions]);

  const monthRangeLabel = useMemo(() => {
    const start = (selectedMonth - 1) * MONTH_LEN + 1;
    const end = selectedMonth * MONTH_LEN;
    return `${formatShort(dateFromDay(startDate, start))} – ${formatShort(
      dateFromDay(startDate, end)
    )}`;
  }, [selectedMonth, startDate]);

  // ---- Render ----------------------------------------------------------
  return (
    <div className={`min-h-screen w-full bg-[#08080b] text-white/90 font-semibold ${poppins.className}`}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              Reto de 6 meses · Mes {selectedMonth} ({monthRangeLabel})
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Día{" "}
              <span className="bg-gradient-to-r from-[#7C5CFF] via-[#00E5D6] via-[#FFA31A] to-[#FF4D4D] bg-clip-text text-transparent">
                {currentDay}
              </span>
              <span className="text-white/30">/{TOTAL_DAYS}</span>
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Cumplimiento total:{" "}
              <span className="font-semibold text-white/80">{overallPct ?? 0}%</span>
              {!progressLoaded && (
                <span className="ml-2 text-white/30">cargando desde Airtable…</span>
              )}
            </p>
            {progressError && (
              <p className="mt-1 text-xs text-[#FF4D4D]">{progressError}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
            >
              + Hábito
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
            >
              ⚙ Ajustes
            </button>
          </div>
        </div>

        {/* Selector de mes */}
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: MONTH_COUNT }, (_, i) => i + 1).map((m) => {
            const isActive = m === selectedMonth;
            const isCurrent = m === currentMonth;
            return (
              <button
                key={m}
                onClick={() => {
                  setSelectedMonth(m);
                  setMonthTouched(true);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/10 text-white/40 hover:border-white/25"
                }`}
              >
                Mes {m}
                {isCurrent && <span className="ml-1 text-[9px] text-[#00E5D6]">●</span>}
              </button>
            );
          })}
        </div>

        {/* Gráfico + retroalimentación */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mb-6">
          <ProgressChart dailyStats={monthDailyStats} monthLen={MONTH_LEN} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <FeedbackCard label="Esta semana" stats={weekStats} />
            <FeedbackCard label="Este mes" stats={monthStats} />
          </div>
        </div>

        {/* Filtros por área */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveArea("all")}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              activeArea === "all"
                ? "border-white/40 bg-white/10 text-white"
                : "border-white/10 text-white/50 hover:border-white/30"
            }`}
          >
            Todas
          </button>
          {AREA_ORDER.map((key) => {
            const area = AREAS[key];
            const active = activeArea === key;
            return (
              <button
                key={key}
                onClick={() => setActiveArea(key)}
                className="rounded-full border px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5"
                style={{
                  borderColor: active ? area.color : "rgba(255,255,255,0.1)",
                  backgroundColor: active ? `${area.color}22` : "transparent",
                  color: active ? area.color : "rgba(255,255,255,0.5)",
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: area.color }} />
                {area.label}
              </button>
            );
          })}
        </div>

        {/* Grilla de hábitos del mes seleccionado */}
        <HabitGrid
          habits={filteredHabits}
          completions={completions}
          currentDay={currentDay}
          startDate={startDate}
          selectedMonth={selectedMonth}
          onToggle={toggleDay}
        />

        {habits.length === 0 && (
          <p className="mt-6 text-center text-sm text-white/40">
            No tienes hábitos cargados todavía. Agrega uno con "+ Hábito".
          </p>
        )}
      </div>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} title="Hábitos">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/40">
                Nuevo hábito
              </label>
              <div className="flex gap-2">
                <input
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  placeholder="Nombre del hábito"
                  className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
                />
                <select
                  value={newHabitArea}
                  onChange={(e) => setNewHabitArea(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#111116] px-2 py-2 text-sm outline-none focus:border-white/30"
                >
                  {AREA_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {AREAS[key].label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addHabit}
                  className="rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/20 transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/40">
                Hábitos actuales
              </label>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: AREAS[h.area]?.color }}
                      />
                      <span className="truncate text-sm">{h.name}</span>
                    </div>
                    <button
                      onClick={() => removeHabit(h.id)}
                      className="text-xs text-white/40 hover:text-[#FF4D4D] transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showSettingsModal && (
        <Modal
          onClose={() => {
            setShowSettingsModal(false);
            setConfirmReset(false);
          }}
          title="Ajustes"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/40">
                Fecha de inicio del reto
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
              <p className="text-xs text-white/30">
                Define el Día 1 del contador. El día y mes actuales se recalculan
                automáticamente según esta fecha.
              </p>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-4">
              <label className="text-xs uppercase tracking-wide text-white/40">
                Zona de peligro
              </label>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="w-full rounded-md border border-[#FF4D4D]/40 bg-[#FF4D4D]/10 px-3 py-2 text-sm text-[#FF4D4D] hover:bg-[#FF4D4D]/20 transition-colors"
                >
                  Reiniciar progreso
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#FF4D4D]">
                    Esto borra todas las marcas de hábitos cumplidos. No se puede
                    deshacer. ¿Confirmas?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={resetProgress}
                      className="flex-1 rounded-md bg-[#FF4D4D] px-3 py-2 text-sm text-black font-medium hover:opacity-90 transition-opacity"
                    >
                      Sí, reiniciar
                    </button>
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de retroalimentación
// ---------------------------------------------------------------------------

function FeedbackCard({ label, stats }) {
  const { pct, delta } = stats;
  const hasDelta = delta !== null && delta !== undefined;
  const deltaColor = !hasDelta ? "text-white/30" : delta >= 0 ? "text-[#8FCB6E]" : "text-[#FF4D4D]";
  const deltaArrow = !hasDelta ? "" : delta >= 0 ? "▲" : "▼";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
        {hasDelta && (
          <span className={`text-xs font-semibold ${deltaColor}`}>
            {deltaArrow} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-3xl font-bold text-white/90">{pct ?? 0}%</p>
      <p className="mt-2 text-xs leading-snug text-white/50">{feedbackMessage(pct)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráfico SVG de progreso diario (dominio: mes seleccionado)
// ---------------------------------------------------------------------------

function ProgressChart({ dailyStats, monthLen }) {
  const width = 700;
  const height = 220;
  const padTop = 12;
  const padBottom = 24;
  const chartHeight = height - padTop - padBottom;

  const xFor = (indexInMonth) => (indexInMonth / Math.max(monthLen - 1, 1)) * width;
  const yFor = (pct) => padTop + chartHeight - (pct / 100) * chartHeight;

  const points = dailyStats.map((s, i) => [xFor(i), yFor(s.pct)]);

  const smoothSegments = (pts) => {
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  };

  const linePath =
    points.length > 1
      ? `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}` + smoothSegments(points)
      : points.length === 1
      ? `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
      : "";

  const areaPath =
    points.length > 0
      ? `M${points[0][0].toFixed(2)},${(padTop + chartHeight).toFixed(2)} ` +
        `L${points[0][0].toFixed(2)},${points[0][1].toFixed(2)} ` +
        smoothSegments(points) +
        ` L${points[points.length - 1][0].toFixed(2)},${(padTop + chartHeight).toFixed(2)} Z`
      : "";

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      {points.length === 0 ? (
        <div className="flex h-40 sm:h-48 items-center justify-center text-xs text-white/30">
          Este mes todavía no ha comenzado.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 sm:h-48"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="progressLineGradient" x1="0" y1="0" x2="1" y2="0">
              {GRADIENT_STOPS.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
            <linearGradient id="progressAreaGradient" x1="0" y1="0" x2="1" y2="0">
              {GRADIENT_STOPS.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity="0.18" />
              ))}
            </linearGradient>
          </defs>

          {gridLines.map((g) => (
            <line
              key={g}
              x1={0}
              x2={width}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}

          {areaPath && <path d={areaPath} fill="url(#progressAreaGradient)" stroke="none" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#progressLineGradient)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          <circle
            cx={points[points.length - 1][0]}
            cy={points[points.length - 1][1]}
            r={4}
            fill="#FF4D4D"
            stroke="#08080b"
            strokeWidth={1.5}
          />
        </svg>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-white/30">
        <span>Inicio de mes</span>
        <span>% hábitos cumplidos por día</span>
        <span>Fin de mes</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grilla de hábitos x días del mes seleccionado, agrupada por semanas
// ---------------------------------------------------------------------------

function HabitGrid({ habits, completions, currentDay, startDate, selectedMonth, onToggle }) {
  const monthStart = (selectedMonth - 1) * MONTH_LEN + 1;
  const dayList = useMemo(
    () => Array.from({ length: MONTH_LEN }, (_, i) => monthStart + i),
    [monthStart]
  );

  const weekBands = useMemo(() => {
    const bands = [];
    for (let i = 0; i < dayList.length; i += 7) {
      const chunk = dayList.slice(i, i + 7);
      bands.push({
        startCol: i + 2, // +1 por la columna de nombre (col 1), +1 porque grid-column es 1-indexado
        span: chunk.length,
        label: `${formatShort(dateFromDay(startDate, chunk[0]))} – ${formatShort(
          dateFromDay(startDate, chunk[chunk.length - 1])
        )}`,
      });
    }
    return bands;
  }, [dayList, startDate]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <div
        className="inline-grid min-w-full gap-[3px]"
        style={{ gridTemplateColumns: `200px repeat(${MONTH_LEN}, 26px)` }}
      >
        {/* Banda de semanas */}
        <div className="sticky left-0 z-20 border-b border-white/10 bg-[#08080b]" />
        {weekBands.map((band) => (
          <div
            key={band.startCol}
            style={{ gridColumn: `${band.startCol} / span ${band.span}` }}
            className="border-b border-white/10 bg-white/[0.03] px-1 py-1 text-center text-[9px] text-white/35"
          >
            {band.label}
          </div>
        ))}

        {/* Header de días */}
        <div className="sticky left-0 z-20 flex items-end border-b border-white/10 bg-[#08080b] px-3 py-2 text-[10px] uppercase tracking-wide text-white/30">
          Hábito
        </div>
        {dayList.map((day) => {
          const isToday = day === currentDay;
          const date = dateFromDay(startDate, day);
          const dayOfMonthLocal = day - monthStart + 1;
          return (
            <div
              key={day}
              title={formatShort(date)}
              className={`flex items-end justify-center border-b border-white/10 py-2 text-[9px] ${
                isToday ? "bg-white/10 font-bold text-white" : "text-white/25"
              }`}
            >
              {dayOfMonthLocal}
            </div>
          );
        })}

        {/* Filas de hábitos */}
        {habits.map((habit) => {
          const color = AREAS[habit.area]?.color || "#888888";
          const streak = getStreak(habit.id, completions, currentDay);
          return (
            <React.Fragment key={habit.id}>
              <div className="sticky left-0 z-10 flex items-center justify-between gap-2 border-b border-white/5 bg-[#08080b] px-3 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate text-xs text-white/80">{habit.name}</span>
                </div>
                {streak > 0 && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-[#FFA31A]">
                    🔥{streak}
                  </span>
                )}
              </div>

              {dayList.map((day) => {
                const done = !!completions[habit.id]?.[day];
                const isFuture = day > currentDay;
                const isToday = day === currentDay;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isFuture}
                    onClick={() => onToggle(habit.id, day)}
                    title={formatShort(dateFromDay(startDate, day))}
                    className={`aspect-square rounded-md m-[2px] transition-colors ${
                      done ? "" : "bg-white/5"
                    } ${
                      isFuture ? "cursor-not-allowed opacity-25" : "cursor-pointer hover:opacity-80"
                    } ${isToday ? "ring-1 ring-inset ring-white/40" : ""}`}
                    style={{ backgroundColor: done ? color : undefined }}
                  >
                    {done && (
                      <span className="block text-[10px] leading-none text-black/70">✓</span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal genérico
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d0d12] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
