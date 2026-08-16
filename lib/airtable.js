/**
 * Helper de acceso a la base de Airtable "Dashboard de Habitos - 6 Meses".
 *
 * Requiere estas variables de entorno (configuradas en Vercel, o en un
 * archivo .env.local para desarrollo local — nunca las subas al repo):
 *   AIRTABLE_API_KEY  → Personal Access Token de Airtable
 *   AIRTABLE_BASE_ID  → appLtrIKx7zf4ZR60 (esta base específica)
 *
 * Los IDs de tabla/campo de abajo son fijos porque pertenecen a esta base
 * en particular (no cambian aunque renombres columnas en la UI de Airtable).
 */

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

export const PROGRESO_TABLE_ID = "tblwCtuUfNIE2uZrx";

export const FIELDS = {
  FECHA: "fldUQYWuQ3n1ixbGK",
  DIA: "fldAGWrucuKY4MCw8",
  HABITO: "fldSDNtztqOOwpELK",
};

// Mapea las claves de hábito usadas en el dashboard (h1..h6) a los IDs de
// registro reales en la tabla "Habitos" de Airtable.
export const HABIT_RECORD_IDS = {
  h1: "rect4dPoF9eSte4Ie", // Levantarme 5am
  h2: "receItUGNPjbW6aA3", // Tiempo con Dios
  h3: "reckkNm9c3BibeP4X", // Round 1
  h5: "recXalvrccARDPjl1", // Cuello y hielo
  h6: "recLAkDrkx6JZEJes", // Negocio
  h4: "recQGpbw61wvL2Gu1", // Round 2
};

export const RECORD_ID_TO_HABIT_ID = Object.fromEntries(
  Object.entries(HABIT_RECORD_IDS).map(([habitId, recordId]) => [recordId, habitId])
);

function baseId() {
  const id = process.env.AIRTABLE_BASE_ID;
  if (!id) throw new Error("Falta la variable de entorno AIRTABLE_BASE_ID");
  return id;
}

function authHeaders() {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("Falta la variable de entorno AIRTABLE_API_KEY");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function airtableFetch(path, options = {}) {
  const url = `${AIRTABLE_API_URL}/${baseId()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `Airtable respondió ${res.status}`;
    throw new Error(message);
  }
  return data;
}

// Trae TODOS los registros de la tabla Progreso (maneja paginación).
export async function fetchAllProgressRecords() {
  let records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const data = await airtableFetch(`/${PROGRESO_TABLE_ID}?${params.toString()}`);
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}
