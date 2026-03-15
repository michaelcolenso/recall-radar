import { z } from "zod";

const makeSchema = z.object({ Make_ID: z.number(), Make_Name: z.string() });
const modelSchema = z.object({ Make_ID: z.number(), Make_Name: z.string(), Model_ID: z.number(), Model_Name: z.string() });
const recallSchema = z.object({
  NHTSACampaignNumber: z.string(),
  ReportReceivedDate: z.string().default(""),
  Component: z.string(),
  Manufacturer: z.string().default(""),
  Summary: z.string().default(""),
  Consequence: z.string().default(""),
  Remedy: z.string().default(""),
});

export type NhtsaMake = z.infer<typeof makeSchema>;
export type NhtsaModel = z.infer<typeof modelSchema>;
export type NhtsaRecall = z.infer<typeof recallSchema>;

// vPIC API returns "Results" (capital R)
const vpicEnvelope = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ Count: z.number(), Results: z.array(schema) });

// Recalls API returns "results" (lowercase r)
const recallsEnvelope = z.object({ Count: z.number(), results: z.array(recallSchema) });

async function fetchWithRetry(url: string, retries = 3, timeoutMs = 15000): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchAllMakes(): Promise<NhtsaMake[]> {
  const res = await fetchWithRetry("https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json");
  const data = await res.json();
  return vpicEnvelope(makeSchema).parse(data).Results;
}

export async function fetchModelsForMake(makeId: number): Promise<NhtsaModel[]> {
  const res = await fetchWithRetry(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/${makeId}?format=json`);
  const data = await res.json();
  return vpicEnvelope(modelSchema).parse(data).Results;
}

export async function fetchRecallsForVehicle(make: string, model: string, year: number): Promise<NhtsaRecall[]> {
  await delay(300);
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) return [];
  const data = await res.json();
  return recallsEnvelope.parse(data).results;
}
