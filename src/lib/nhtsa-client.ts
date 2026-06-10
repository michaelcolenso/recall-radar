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
      try {
        const res = await fetch(url, { signal: controller.signal });
        return res;
      } finally {
        clearTimeout(timer);
      }
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

// ─── VIN LOOKUP ─────────────────────────────────────────────────

// NHTSA's internal /vehicles/byVinProxy endpoint. Auth uses timestamp + key
// where key = timestamp - SESSION_CONST. The constant is session-bound and
// obtained by capturing a page-load HAR from www.nhtsa.gov/recalls.
// Rotate via NHTSA_VIN_SESSION_TS / NHTSA_VIN_SESSION_KEY env vars.
// If unset, falls back to the public vPIC decoder.

const byVinProxyResultSchema = z.object({
  vehicleId: z.number(),
  modelYear: z.number(),
  make: z.string(),
  vehicleModel: z.string(),
  trim: z.string().optional(),
  series: z.string().optional(),
  class: z.string().optional(),
  manufacturer: z.string().optional(),
  recallsCount: z.number().optional(),
  complaintsCount: z.number().optional(),
  investigationsCount: z.number().optional(),
  manufacturerCommunicationsCount: z.number().optional(),
  vehiclePicture: z.string().optional(),
});

const byVinProxyEnvelope = z.object({
  meta: z.object({ status: z.number() }),
  results: z.array(byVinProxyResultSchema),
  decoder: z.array(z.object({
    modelYear: z.string(),
    make: z.string(),
    vehicleModel: z.string(),
    vehicleType: z.string().optional(),
    source: z.string(),
    errors: z.array(z.unknown()),
  })).optional(),
});

export interface DecodedVin {
  make: string;
  model: string;
  year: number;
  bodyClass: string;
  vehicleType: string;
  errorCode: string;
  errorText: string;
}

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export function validateVin(vin: string): { valid: boolean; error?: string } {
  const cleaned = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  if (cleaned.length !== 17) {
    return { valid: false, error: "VIN must be exactly 17 characters." };
  }
  if (!VIN_REGEX.test(cleaned)) {
    return { valid: false, error: "VIN contains invalid characters. VINs use letters A-Z (except I, O, Q) and digits 0-9." };
  }
  return { valid: true };
}

// vPIC fallback decoder (no auth required, public API)
export async function decodeVinVpic(vin: string): Promise<DecodedVin> {
  const vinDecodeSchema = z.object({
    Make: z.string(),
    Model: z.string(),
    ModelYear: z.string(),
    ErrorCode: z.string(),
    ErrorText: z.string(),
    BodyClass: z.string().optional(),
    VehicleType: z.string().optional(),
  });
  const vinDecodeEnvelope = z.object({
    Count: z.number(),
    Results: z.array(vinDecodeSchema),
  });

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin.toUpperCase())}?format=json`;
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`vPIC VIN decode failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  const parsed = vinDecodeEnvelope.parse(data);
  const r = parsed.Results[0];
  if (!r) throw new Error("vPIC returned no results for this VIN.");
  return {
    make: r.Make,
    model: r.Model,
    year: parseInt(r.ModelYear, 10),
    bodyClass: r.BodyClass || "",
    vehicleType: r.VehicleType || "",
    errorCode: r.ErrorCode,
    errorText: r.ErrorText,
  };
}

// NHTSA byVinProxy decoder (requires session key, but returns official data + counts)
export async function decodeVinProxy(
  vin: string,
  sessionTs?: string,
  sessionKey?: string,
): Promise<{ vehicle: DecodedVin; recallsCount: number }> {
  const ts = sessionTs || "";
  const key = sessionKey || "";
  const params = new URLSearchParams({
    productDetail: "all",
    data: "none",
    vin: vin.toUpperCase(),
  });
  if (ts) params.set("timestamp", ts);
  if (key) params.set("key", key);

  const url = `https://api.nhtsa.gov/vehicles/byVinProxy?${params.toString()}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    // Fall back to vPIC if byVinProxy auth fails
    const vehicle = await decodeVinVpic(vin);
    return { vehicle, recallsCount: 0 };
  }
  const data = await res.json();
  const parsed = byVinProxyEnvelope.parse(data);

  const result = parsed.results[0];
  if (!result) throw new Error("NHTSA returned no vehicle data for this VIN.");

  const decoderInfo = (parsed.decoder && parsed.decoder[0]) || null;

  return {
    vehicle: {
      make: result.make,
      model: result.vehicleModel,
      year: result.modelYear,
      bodyClass: result.class || "",
      vehicleType: decoderInfo?.vehicleType || "",
      errorCode: "0",
      errorText: "",
    },
    recallsCount: result.recallsCount || 0,
  };
}

export async function decodeVin(vin: string): Promise<DecodedVin> {
  // Always use vPIC as the primary decoder (no auth, reliable)
  return decodeVinVpic(vin);
}

export async function fetchRecallsByVin(
  vin: string,
  sessionTs?: string,
  sessionKey?: string,
): Promise<{ vehicle: DecodedVin; recalls: NhtsaRecall[]; recallsCount: number }> {
  let vehicle: DecodedVin;
  let recallsCount = 0;

  // Try NHTSA byVinProxy first (gives precise recall count for this VIN)
  if (sessionTs && sessionKey) {
    try {
      const proxyResult = await decodeVinProxy(vin, sessionTs, sessionKey);
      vehicle = proxyResult.vehicle;
      recallsCount = proxyResult.recallsCount;
    } catch {
      // Fall through to vPIC
      vehicle = await decodeVinVpic(vin);
    }
  } else {
    vehicle = await decodeVinVpic(vin);
  }

  if (vehicle.errorCode !== "0" && vehicle.errorCode !== "") {
    if (!vehicle.make || !vehicle.model || isNaN(vehicle.year)) {
      throw new Error(vehicle.errorText || "Unable to decode this VIN.");
    }
  }
  if (!vehicle.make || !vehicle.model || isNaN(vehicle.year) || vehicle.year < 1900) {
    throw new Error("Could not determine the vehicle make, model, or year from this VIN.");
  }

  const recalls = await fetchRecallsForVehicle(vehicle.make, vehicle.model, vehicle.year);
  return { vehicle, recalls, recallsCount };
}
