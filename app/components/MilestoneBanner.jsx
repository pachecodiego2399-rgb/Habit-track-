"use client";

import { useState } from "react";

const WEEKLY_MESSAGES = [
  "La vida que conversamos te espera. Sigue adelante. No se trata de hacer, se trata de ser. El objetivo está en construir a esa persona. Cada día construyes al hombre que fuiste diseñado por Dios.",
  "Una semana más construyendo. No mires el resultado de hoy, mira quién te estás convirtiendo. Eso no se improvisa, se construye.",
  "Siete días de decisiones pequeñas. Así se forma un carácter. Sigue.",
  "No es sobre completar una lista. Es sobre quién eres cuando nadie te ve. Otra semana, más cerca de ese hombre.",
  "La constancia no se siente heroica día a día. Pero mira hacia atrás: una semana entera construyendo al hombre que fuiste diseñado por Dios.",
];

const MONTHLY_MESSAGES = [
  "Un mes. No de hacer cosas, de convertirte en alguien. Esa es la diferencia entre una lista de tareas y una vida con dirección. Sigue construyendo al hombre que fuiste diseñado por Dios.",
  "Treinta días no cambian a una persona de golpe, pero sí trazan una dirección. Y tú llevas un mes entero apuntando hacia la misma persona. Sigue.",
  "Un mes de presencia constante. Eso es lo que separa a quien intenta de quien construye. No te detengas.",
];

export default function MilestoneBanner({ day }) {
  const [dismissed, setDismissed] = useState(false);

  if (!day || day <= 0 || dismissed) return null;

  const isMonth = day % 30 === 0;
  const isWeek = !isMonth && day % 7 === 0;
  if (!isMonth && !isWeek) return null;

  let kicker;
  let message;
  if (isMonth) {
    const monthNumber = Math.floor(day / 30);
    const idx = Math.abs((monthNumber - 1) % MONTHLY_MESSAGES.length);
    kicker = `Mes ${monthNumber} completo`;
    message = MONTHLY_MESSAGES[idx];
  } else {
    const weekNumber = Math.floor(day / 7);
    const idx = Math.abs((weekNumber - 1) % WEEKLY_MESSAGES.length);
    kicker = `Semana ${weekNumber} completa`;
    message = WEEKLY_MESSAGES[idx];
  }

  return (
    <div className="animate-milestone-in relative mb-6 overflow-hidden rounded-2xl border border-[#FFD700]/25 bg-gradient-to-br from-[#FFD700]/[0.08] via-white/[0.02] to-transparent p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar"
        className="absolute right-3 top-3 text-white/30 transition-colors hover:text-white/60"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 1L13 13M13 1L1 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-6 sm:items-center">
        <svg
          className="mt-0.5 shrink-0 sm:mt-0"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="#FFD700"
            fillOpacity="0.9"
          />
        </svg>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD700]/70">
            {kicker}
          </p>
          <p className="text-sm leading-relaxed text-white/85 sm:text-base">{message}</p>
        </div>
      </div>
    </div>
  );
}
