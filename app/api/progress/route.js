import { NextResponse } from "next/server";
import {
  airtableFetch,
  fetchAllProgressRecords,
  FIELDS,
  HABIT_RECORD_IDS,
  RECORD_ID_TO_HABIT_ID,
  PROGRESO_TABLE_ID,
} from "../../../lib/airtable";

function dateFromDay(startDateISO, dayNumber) {
  const start = new Date(`${startDateISO}T00:00:00Z`);
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Día del reto (1 = fecha de inicio) para una fecha ISO. Puede ser <= 0 si la
// fecha es anterior al inicio (registros de un reto anterior).
function dayFromDate(fechaISO, startDateISO) {
  const ms = Date.parse(`${fechaISO}T00:00:00Z`) - Date.parse(`${startDateISO}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

// Día dentro del reto que arranca en startDate, según el campo Fecha del
// registro. Devuelve null si el registro es de un reto anterior (o no tiene
// fecha), así el historial queda en Airtable pero fuera del reto actual.
function challengeDay(record, startDateISO) {
  const fecha = record.fields[FIELDS.FECHA];
  if (typeof fecha !== "string" || !ISO_DATE.test(fecha.slice(0, 10))) return null;
  const day = dayFromDate(fecha.slice(0, 10), startDateISO);
  return day >= 1 ? day : null;
}

// GET /api/progress?startDate=YYYY-MM-DD → { entries: [{ recordId, habitId, day }] }
// Solo devuelve los registros del reto que arranca en startDate.
export async function GET(request) {
  try {
    const startDate = new URL(request.url).searchParams.get("startDate");
    if (!startDate || !ISO_DATE.test(startDate)) {
      return NextResponse.json({ error: "startDate inválido (YYYY-MM-DD)" }, { status: 400 });
    }
    const records = await fetchAllProgressRecords();
    const entries = [];
    for (const record of records) {
      const day = challengeDay(record, startDate);
      if (day === null) continue;
      const linkedIds = record.fields[FIELDS.HABITO] || [];
      for (const recordId of linkedIds) {
        const habitId = RECORD_ID_TO_HABIT_ID[recordId];
        if (habitId) entries.push({ recordId: record.id, habitId, day });
      }
    }
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("GET /api/progress:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST /api/progress
//   marcar:    { habitId, day, completed: true, startDate }
//   desmarcar: { habitId, day, completed: false, recordId }
export async function POST(request) {
  try {
    const body = await request.json();
    const { habitId, day, completed } = body;
    const habitRecordId = HABIT_RECORD_IDS[habitId];

    if (!habitRecordId || !Number.isInteger(day)) {
      return NextResponse.json({ error: "habitId o day inválido" }, { status: 400 });
    }

    if (completed) {
      const fecha = dateFromDay(body.startDate || "2026-11-11", day);
      const data = await airtableFetch(`/${PROGRESO_TABLE_ID}`, {
        method: "POST",
        body: JSON.stringify({
          records: [
            {
              fields: {
                [FIELDS.FECHA]: fecha,
                [FIELDS.DIA]: day,
                [FIELDS.HABITO]: [habitRecordId],
              },
            },
          ],
        }),
      });
      return NextResponse.json({ recordId: data.records[0].id });
    }

    const { recordId } = body;
    if (!recordId) {
      return NextResponse.json({ error: "recordId requerido para desmarcar" }, { status: 400 });
    }
    await airtableFetch(`/${PROGRESO_TABLE_ID}/${recordId}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/progress:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// DELETE /api/progress?startDate=YYYY-MM-DD → borra solo las marcas del reto
// actual (fecha >= startDate). Los retos anteriores no se tocan.
export async function DELETE(request) {
  try {
    const startDate = new URL(request.url).searchParams.get("startDate");
    if (!startDate || !ISO_DATE.test(startDate)) {
      return NextResponse.json({ error: "startDate inválido (YYYY-MM-DD)" }, { status: 400 });
    }
    const records = await fetchAllProgressRecords();
    const ids = records.filter((r) => challengeDay(r, startDate) !== null).map((r) => r.id);
    // Airtable permite borrar hasta 10 registros por llamada.
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const params = new URLSearchParams();
      batch.forEach((id) => params.append("records[]", id));
      await airtableFetch(`/${PROGRESO_TABLE_ID}?${params.toString()}`, { method: "DELETE" });
    }
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error("DELETE /api/progress:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
