import { slugify } from '../lib/utils';
export type VehicleType = 'passenger' | 'motorcycle' | 'commercial';
export function normalizeModel(make: string, model: string): { make: string; model: string; slug: string; vehicleType: VehicleType; sourceModel: string } {
  const sourceModel = model;
  make = make.trim().toUpperCase().replace(/^MERCEDES BENZ$/, 'MERCEDES-BENZ');
  model = model.trim().replace(/\s+/g, ' ');
  const compact = model.toUpperCase().replace(/[\s-]/g, '');
  let vehicleType: VehicleType = 'passenger';
  if (make === 'DODGE' && /^RAM(1500|2500|3500)$/.test(compact)) {
    make = 'RAM'; model = compact.slice(3);
  }
  if (make === 'RAM') model = model.replace(/^RAM\s*/i, '').replace(/\s+(CLASSIC|PICKUP).*$/i, '');
  if (make === 'MERCEDES-BENZ') {
    if (/^(L\d{4}|LP\d{4}|TOURRIDER|UNIMOG|ACTROS|ATEGO|ECONIC)/.test(compact)) vehicleType = 'commercial';
    for (const family of ['GLA','GLB','GLC','GLE','GLS','CLA','CLS','SL','C','E','S','G','M']) {
      if (new RegExp(`^${family}(?:CLASS|\\d{2,3}(?:AMG|[A-Z].*)?|AMG\\d{2,3})$`).test(compact)) {
        model = `${family}-Class`; break;
      }
    }
    if (/SPRINTER/.test(compact)) model = 'Sprinter';
    if (/METRIS/.test(compact)) model = 'Metris';
  }
  if ((make === 'HONDA' && /^(CB\d|CBR|CRF|CMX|NC\d|VFR|VT\d|VTX|GL\d|GOLDWING|REBEL|SHADOW|AFRICA|PCX|GROM|TRX|FOURTRAX|PIONEER|TALON|RANCHER|FOREMAN)/.test(compact)) ||
      (make === 'BMW' && /^(?:[RFKGS]\d{2,4}(?:GS|GT|GTL|RT|RS|RR|XR|R|S|B|C|X)?|CE0[24]|HP[24])$/.test(compact))) vehicleType = 'motorcycle';
  return { make, model, slug: slugify(model), vehicleType, sourceModel };
}
export function canonicalModelGroups(make: string, models: { Model_Name: string }[]): { name: string; slug: string; sources: string[] }[] {
  const groups = new Map<string, { name: string; slug: string; sources: string[] }>();
  const names = models.map(m => m.Model_Name);
  if (make.toUpperCase() === 'RAM') names.push('1500', '2500', '3500');
  for (const source of names) {
    const n = normalizeModel(make, source);
    if (n.vehicleType !== 'passenger' || n.make !== make.toUpperCase()) continue;
    const group = groups.get(n.slug) ?? { name: n.model, slug: n.slug, sources: [] };
    if (!group.sources.includes(source)) group.sources.push(source);
    groups.set(n.slug, group);
  }
  return [...groups.values()];
}
export function recallSources(make: string, model: string, year: number, sources: string[] = [model]): { make: string; model: string }[] {
  const result = sources.map(model => ({make, model}));
  if (make.toUpperCase() === 'RAM' && /^(1500|2500|3500)$/.test(model)) {
    result.push({make:'RAM', model:`RAM ${model}`});
    if (year <= 2010) result.push({make:'DODGE', model:`RAM ${model}`});
  }
  return result;
}
