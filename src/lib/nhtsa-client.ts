import { z } from "zod";

const makeSchema = z.object({ Make_ID: z.number(), Make_Name: z.string() });
const modelSchema = z.object({ Model_ID: z.number(), Model_Name: z.string() });
const recallSchema = z.object({
  NHTSACampaignNumber: z.string(),
  NHTSAActionNumber: z.string().optional().default(""),
  Component: z.string(),
  Summary: z.string(),
  Consequence: z.string().default(""),
  Remedy: z.string().default("")
});

export type NhtsaMake = z.infer<typeof makeSchema>;
export type NhtsaModel = z.infer<typeof modelSchema>;
export type NhtsaRecall = z.infer<typeof recallSchema>;

const resultEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ Results: z.array(schema) });

export async function fetchMakes(): Promise<NhtsaMake[]> {
  const res = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json");
  const data = await res.json();
  return resultEnvelope(makeSchema).parse(data).Results;
}

export async function fetchModels(make: string): Promise<NhtsaModel[]> {
  const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${encodeURIComponent(make)}?format=json`);
  const data = await res.json();
  return resultEnvelope(modelSchema).parse(data).Results;
}

export async function fetchRecalls(make: string, model: string, year: number): Promise<NhtsaRecall[]> {
  const res = await fetch(
    `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return resultEnvelope(recallSchema).parse(data).Results;
}
