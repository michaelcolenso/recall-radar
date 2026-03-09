import { z } from "zod";
import { throttledFetch } from "./rate-limiter";
import { POPULAR_MAKES } from "./constants";

// ─── Zod Schemas ────────────────────────────────────────────────

const VPICMakesResponseSchema = z.object({
  Count: z.number(),
  Results: z.array(
    z.object({
      Make_ID: z.number(),
      Make_Name: z.string(),
    }),
  ),
});

const VPICModelsResponseSchema = z.object({
  Count: z.number(),
  Results: z.array(
    z.object({
      Make_ID: z.number(),
      Make_Name: z.string(),
      Model_ID: z.number(),
      Model_Name: z.string(),
    }),
  ),
});

// Note: Recalls API uses lowercase "results" (unlike vPIC which uses "Results")
const RecallsResponseSchema = z.object({
  Count: z.number(),
  results: z
    .array(
      z.object({
        NHTSACampaignNumber: z.string(),
        ReportReceivedDate: z.string().nullable().optional(),
        Component: z.string(),
        Summary: z.string(),
        Consequence: z.string(),
        Remedy: z.string(),
        Manufacturer: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
});

// ─── Exported Types ──────────────────────────────────────────────

export type NhtsaMake = {
  Make_ID: number;
  Make_Name: string;
};

export type NhtsaModel = {
  Make_ID: number;
  Make_Name: string;
  Model_ID: number;
  Model_Name: string;
};

export type NhtsaRecall = {
  NHTSACampaignNumber: string;
  ReportReceivedDate?: string | null;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  Manufacturer?: string | null;
};

// ─── API Functions ───────────────────────────────────────────────

export async function getAllMakes(popularOnly = true): Promise<NhtsaMake[]> {
  const url =
    "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json";
  const data = await throttledFetch(url, VPICMakesResponseSchema, "GetAllMakes");

  if (popularOnly) {
    return data.Results.filter((m) =>
      POPULAR_MAKES.has(m.Make_Name.toUpperCase()),
    );
  }
  return data.Results;
}

export async function getModelsForMake(makeId: number): Promise<NhtsaModel[]> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/${makeId}?format=json`;
  const data = await throttledFetch(
    url,
    VPICModelsResponseSchema,
    `GetModelsForMakeId/${makeId}`,
  );
  return data.Results;
}

export async function getRecallsByVehicle(
  make: string,
  model: string,
  year: number,
): Promise<NhtsaRecall[]> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  const data = await throttledFetch(
    url,
    RecallsResponseSchema,
    `recalls/${make}/${model}/${year}`,
  );
  return data.results;
}
