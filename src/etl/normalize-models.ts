import { slugify } from '../lib/utils';
export type VehicleType = 'passenger' | 'motorcycle' | 'commercial';
export function normalizeModel(make: string, model: string): { make: string; model: string; slug: string; vehicleType: VehicleType; sourceModel: string } {
  const sourceModel = model;
  make = make.trim().toUpperCase().replace(/^MERCEDES BENZ$/, 'MERCEDES-BENZ');
  model = model.trim().replace(/\s+/g, ' ');
  const compact = model.toUpperCase().replace(/[\s-]/g, '').replace(/^AMG/, '');
  let vehicleType: VehicleType = 'passenger';
  if (make === 'DODGE' && /^RAM(1500|2500|3500)$/.test(compact)) {
    make = 'RAM'; model = compact.slice(3);
  }
  if (['DODGE','FREIGHTLINER'].includes(make) && /^SPRINTER(?:2500|3500)?$/.test(compact)) {
    make = 'MERCEDES-BENZ'; model = 'Sprinter';
  }
  if (make === 'RAM') model = model.replace(/^RAM\s*/i, '').replace(/[\s-]+(CLASSIC|PICKUP).*$/i, '');
  if (make === 'MERCEDES-BENZ') {
    if (/^(L\d{4}|LP\d{4}|TOURRIDER|UNIMOG|ACTROS|ATEGO|ECONIC)/.test(compact)) vehicleType = 'commercial';
    for (const family of ['GLA','GLB','GLC','GLE','GLS','CLA','CLS','SL','C','E','S','G','M']) {
      if (new RegExp(`^${family}(?:CLASS|\\d{2,3}(?:AMG|4MATIC|[A-Z].*)?|AMG\\d{2,3})?$`).test(compact)) {
        model = `${family}-Class`; break;
      }
    }
    if (/SPRINTER/.test(compact)) model = 'Sprinter';
    if (/METRIS/.test(compact)) model = 'Metris';
  }
  if (make === 'BMW') {
    const series=compact.match(/^M?([1-8])\d{2}[A-Z]*$/)?.[1] ?? compact.match(/^ACTIVEHYBRID([357])$/)?.[1];
    if(series) model = `${series} Series`;
  }
  if ((make === 'HONDA' && /^(CB\d|CBR|CRF|CMX|NC\d|VFR|VT\d|VTX|GL\d|GOLDWING|REBEL|SHADOW|AFRICA|PCX|GROM|TRX|FOURTRAX|PIONEER|TALON|RANCHER|FOREMAN|XR\d|CR\d|NSS|NPS|CHF|SH\d|RUCKUS|METROPOLITAN|SXS|CTX\d|ST\d|NT\d|VF\d|VTR\d)/.test(compact)) ||
      (make === 'BMW' && /^(?:RNINET[A-Z]*|[RFKGS]\d{2,4}(?:GS(?:ADVENTURE)?|GSA|GT|GTL|RT|RS|RR|XR|ST|R|S|B|C|X|TRANSCONTINENTAL|CLASSIC|SPORT)?|C(?:400(?:X|GT)|600SPORT|650(?:GT|SPORT)|EVOLUTION)|M1000(?:R|RR|XR)|CE0[24]|HP[24])$/.test(compact))) vehicleType = 'motorcycle';
  return { make, model, slug: slugify(model), vehicleType, sourceModel };
}
export function canonicalModelGroups(make: string, models: { Model_Name: string }[]): { name: string; slug: string; sources: string[] }[] {
  const groups = new Map<string, { name: string; slug: string; sources: string[] }>();
  const names = models.flatMap(m => filingAliases(make,m.Model_Name));
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
  const result = [...new Set(sources.flatMap(source => filingAliases(make,source)))].map(model => ({make, model}));
  if (make.toUpperCase() === 'RAM' && /^(1500|2500|3500)$/.test(model)) {
    result.push({make:'RAM', model:`RAM ${model}`});
    if (year <= 2010) result.push({make:'DODGE', model:`RAM ${model}`});
  }
  if (make.toUpperCase() === 'MERCEDES-BENZ' && normalizeModel(make,model).model === 'Sprinter') {
    // NHTSA filings include both brands: 17V-025 and 20V-180.
    for(const sourceModel of ['SPRINTER','SPRINTER 2500','SPRINTER 3500']) {
      result.push({make:'FREIGHTLINER',model:sourceModel});
      if(year <= 2009) result.push({make:'DODGE',model:sourceModel});
    }
  }
  return [...new Map(result.map(source=>[`${source.make.toUpperCase()}|${source.model.toUpperCase()}`,source])).values()];
}

const MERCEDES_TRIMS: Record<string,string[]> = {
 'C-Class':['C230','C240','C250','C280','C300','C320','C350','C400','C450','C43 AMG','C63 AMG'],
 'E-Class':['E250','E300','E320','E350','E400','E450','E500','E550','E55 AMG','E63 AMG'],
 'S-Class':['S350','S400','S430','S450','S500','S550','S560','S580','S600','S63 AMG','S65 AMG'],
 'GLA-Class':['GLA250','GLA35 AMG','GLA45 AMG'], 'GLB-Class':['GLB250','GLB35 AMG'],
 'GLC-Class':['GLC300','GLC350','GLC43 AMG','GLC63 AMG'],
 'GLE-Class':['GLE350','GLE400','GLE450','GLE550','GLE580','GLE43 AMG','GLE53 AMG','GLE63 AMG'],
 'GLS-Class':['GLS450','GLS550','GLS580','GLS63 AMG'],
 'G-Class':['G500','G550','G55 AMG','G63 AMG','G65 AMG'],
 'CLA-Class':['CLA250','CLA35 AMG','CLA45 AMG'], 'CLS-Class':['CLS400','CLS450','CLS500','CLS550','CLS53 AMG','CLS63 AMG'],
 'SL-Class':['SL400','SL450','SL500','SL550','SL55 AMG','SL63 AMG','SL65 AMG'],
 Sprinter:['SPRINTER 2500','SPRINTER 3500'], Metris:['METRIS'],
};
export function filingAliases(make:string,model:string):string[] {
 const canonical = normalizeModel(make,model);
 return [...new Set([model,...(canonical.make==='MERCEDES-BENZ' ? MERCEDES_TRIMS[canonical.model] ?? [] : [])])];
}
