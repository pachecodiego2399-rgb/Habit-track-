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

// GET /api/progress → { entries: [{ recordId, habitId, day }] }
export async function GET() {
  try {
    const records = await fetchAllProgressRecords();
    const entries = [];
    for (const record of records) {
      const day = record.fields[FIELDS.DIA];
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
      const fecha = dateFromDay(body.startDate || "2026-08-07", day);
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

// DELETE /api/progress → borra TODOS los registros de progreso (reiniciar).
export async function DELETE() {
  try {
    const records = await fetchAllProgressRecords();
    const ids = records.map((r) => r.id);
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
