import { slugify, parseNhtsaDate } from "./utils";
import { classifySeverity } from "./severity";
import type { SeverityLevel } from "../db/schema";

/**
 * Fresh NHTSA campaigns (2026-08-06..2026-08-12) verified directly against the
 * NHTSA Recalls API (recallsByVehicle) on 2026-08-19. These are the newest
 * campaigns not yet ingested into the site DB (they 404 on the live site until
 * the daily delta ingestion picks them up).
 *
 * Purpose: ship indexable campaign pages NOW, before ingestion catches up.
 * The /recall/:campaignNumber route renders from the DB when the campaign is
 * present, and falls back to this curated source otherwise. Once daily
 * ingestion saves a campaign, the DB row wins (both sources are NHTSA data).
 *
 * IMPORTANT: affected make/model/year lists here are model-level facts from
 * NHTSA. They NEVER prove an individual vehicle (VIN) is affected — campaign
 * pages carry an explicit VIN-check disclaimer.
 */

export interface FreshCampaignVehicle {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: number;
}

export interface FreshCampaign {
  campaignNumber: string;
  component: string;
  manufacturer: string;
  summary: string;
  consequence: string;
  remedy: string;
  /** ISO date (yyyy-mm-dd) — parsed from NHTSA's DD/MM/YYYY via parseNhtsaDate. */
  reportReceivedDate: string;
  vehicles: FreshCampaignVehicle[];
}

/** Severity is auto-classified with the same rules the ingestion pipeline uses. */
function severityOf(component: string): SeverityLevel {
  return classifySeverity(component);
}

function vehicle(make: string, model: string, year: number): FreshCampaignVehicle {
  return { make, makeSlug: slugify(make), model, modelSlug: slugify(model), year };
}

export const FRESH_CAMPAIGNS: FreshCampaign[] = [
  {
    campaignNumber: "26V525000",
    component: "POWER TRAIN:DRIVESHAFT",
    manufacturer: "BMW of North America, LLC",
    summary:
      "BMW of North America, LLC (BMW) is recalling certain 2022-2026 840i, 840i xDrive, 2021-2023 540i, 540i xDrive, M550i xDrive, and 2024-2026 750e xDrive vehicles. The connection between the driveshaft and the rear differential may become damaged, possibly resulting in a loss of power to the rear wheels or a vehicle rollaway.",
    consequence:
      "An unexpected loss of drive power can increase the risk of a crash. In addition, a damaged driveshaft can result in a vehicle rollaway if the parking brake is not applied, increasing the risk of a crash or injury.",
    remedy:
      "Dealers will inspect the connection between the driveshaft and rear axle differential, and apply adhesive or replace the driveshaft and rear axle differential, as necessary, free of charge. Owner notification letters are expected to be mailed October 2, 2026. Owners may contact BMW customer service at 1-800-525-7417.",
    reportReceivedDate: "2026-08-12",
    vehicles: [
      vehicle("BMW", "840i", 2022), vehicle("BMW", "840i", 2023),
      vehicle("BMW", "840i", 2024), vehicle("BMW", "840i", 2025),
      vehicle("BMW", "840i", 2026), vehicle("BMW", "540i", 2021),
      vehicle("BMW", "540i", 2022), vehicle("BMW", "540i", 2023),
      vehicle("BMW", "M550i", 2021), vehicle("BMW", "M550i", 2022),
      vehicle("BMW", "M550i", 2023), vehicle("BMW", "750e", 2024),
      vehicle("BMW", "750e", 2025), vehicle("BMW", "750e", 2026),
    ],
  },
  {
    campaignNumber: "26V524000",
    component: "STEERING:SPINDLE",
    manufacturer: "BMW of North America, LLC",
    summary:
      "BMW of North America, LLC (BMW) is recalling certain 2024-2026 X3 sDrive30i, X3 30 xDrive, and X3 M50 xDrive vehicles. The steering spindle may have been incorrectly attached to the steering column.",
    consequence:
      "An incorrectly attached steering spindle can lead to a loss of steering control, increasing the risk of a crash.",
    remedy:
      "Dealers will inspect the steering connection and replace hardware or replace the spindle and column, as necessary, free of charge. Owner notification letters are expected to be mailed October 2, 2026. Owners may contact BMW customer service at 1-800-525-7417.",
    reportReceivedDate: "2026-08-12",
    vehicles: [
      vehicle("BMW", "X3", 2024), vehicle("BMW", "X3", 2025), vehicle("BMW", "X3", 2026),
    ],
  },
  {
    campaignNumber: "26V514000",
    component: "SUSPENSION:REAR:SHOCK ABSORBER",
    manufacturer: "Toyota Motor Engineering & Manufacturing",
    summary:
      "Toyota Motor Engineering & Manufacturing (Toyota) is recalling certain 2024 Tacoma Hybrid and 2024-2025 Tacoma vehicles. The metal flange on the front and rear shock absorbers may corrode and fail, resulting in detachment of the external oil reservoir.",
    consequence:
      "An oil reservoir that detaches can create a road hazard, increasing the risk of a crash.",
    remedy:
      "Dealers will inspect and replace the front and rear shock absorber assemblies, as necessary, free of charge. Owner notification letters are expected to be mailed September 21, 2026. Owners may contact Toyota's customer service at 1-800-331-4331.",
    reportReceivedDate: "2026-08-06",
    vehicles: [
      vehicle("Toyota", "Tacoma", 2024), vehicle("Toyota", "Tacoma", 2025),
    ],
  },
  {
    // 26V513000 (Volvo Trucks VNL/VNR 2027): intentionally sparse.
    // The site has no Volvo Trucks model pages (/volvo/vnl, /volvo/vnr 404),
    // so shipping affected-vehicle links would create internal 404s. The
    // campaign page itself is still indexable with summary/remedy/VIN CTA.
    campaignNumber: "26V513000",
    component: "EXTERIOR LIGHTING",
    manufacturer: "Volvo Trucks North America",
    summary:
      "Volvo Trucks North America (Volvo Trucks) is recalling certain 2027 VNL (4) and VNR (4) vehicles. The center roof marker lights may fail to illuminate. As such, these vehicles fail to comply with the requirements of Federal Motor Vehicle Safety Standard number 108, \"Lamps, Reflective Devices, and Associated Equipment.\"",
    consequence:
      "Marker lights that fail to illuminate can reduce visibility, increasing the risk of a crash.",
    remedy:
      "Dealers will replace the center roof marker light, free of charge. Owner notification letters are expected to be mailed October 5, 2026. Owners may contact Volvo Trucks' customer service at 800-528-6586.",
    reportReceivedDate: "2026-08-06",
    vehicles: [],
  },
  {
    campaignNumber: "26V512000",
    component: "ELECTRICAL SYSTEM:TRACTION",
    manufacturer: "Toyota Motor Engineering & Manufacturing",
    summary:
      "Toyota Motor Engineering & Manufacturing (Toyota) is recalling certain 2026 bZ Woodland vehicles equipped with a tow converter. An electrical short circuit may occur within the tow converter printed circuit board, which can deactivate the electronic stability control system.",
    consequence:
      "Deactivated electronic stability control can increase the risk of a crash.",
    remedy:
      "Dealers will replace the tow converter, free of charge. Owner notification letters are expected to be mailed September 21, 2026. Owners may contact Toyota's customer service at 1-800-331-4331.",
    reportReceivedDate: "2026-08-06",
    vehicles: [
      vehicle("Toyota", "bZ Woodland", 2026),
    ],
  },
  {
    campaignNumber: "26V511000",
    component: "ELECTRICAL SYSTEM:INSTRUMENT CLUSTER",
    manufacturer: "Toyota Motor Engineering & Manufacturing",
    summary:
      "Toyota Motor Engineering & Manufacturing (Toyota) is recalling certain 2025-2026 Camry Hybrid vehicles. The instrument cluster display may fail during vehicle startup, deactivating the hazard lights, turn signals, seat belt warning system, and smart key system.",
    consequence:
      "Deactivated warning systems can increase the risk of a crash or injury.",
    remedy:
      "Dealers will update the display software, free of charge. Owner notification letters are expected to be mailed September 21, 2026. Owners may contact Toyota's customer service at 1-800-331-4331.",
    reportReceivedDate: "2026-08-06",
    vehicles: [
      vehicle("Toyota", "Camry", 2025), vehicle("Toyota", "Camry", 2026),
    ],
  },
];

const FRESH_BY_NUMBER = new Map(FRESH_CAMPAIGNS.map((c) => [c.campaignNumber, c]));

export function getFreshCampaign(campaignNumber: string): FreshCampaign | undefined {
  return FRESH_BY_NUMBER.get(campaignNumber.toUpperCase());
}

/** Campaigns whose verified affected-vehicle list includes this make/model. */
export function freshCampaignsForMakeModel(makeSlug: string, modelSlug: string): FreshCampaign[] {
  return FRESH_CAMPAIGNS.filter((c) =>
    c.vehicles.some((v) => v.makeSlug === makeSlug && v.modelSlug === modelSlug),
  );
}

export { severityOf, parseNhtsaDate };
