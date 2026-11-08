import { slugify } from './utils';
// Consumer segments: canonical model families, rather than manufacturer-wide guesses.
const SEGMENTS: Record<string,string[]> = {
 sedan: ['Honda|Accord','Toyota|Camry','Hyundai|Sonata','Chevrolet|Malibu','Nissan|Altima','Kia|K5','Kia|Optima','Ford|Fusion','Subaru|Legacy','Mazda|Mazda6','Volkswagen|Passat','Nissan|Maxima'],
 compact: ['Honda|Civic','Toyota|Corolla','Hyundai|Elantra','Kia|Forte','Nissan|Sentra','Mazda|Mazda3','Volkswagen|Jetta','Volkswagen|Golf','Subaru|Impreza','Chevrolet|Cruze','Ford|Focus','Dodge|Dart'],
 compact_suv: ['Toyota|RAV4','Honda|CR-V','Hyundai|Tucson','Kia|Sportage','Ford|Escape','Chevrolet|Equinox','GMC|Terrain','Nissan|Rogue','Mazda|CX-5','Mazda|CX-50','Subaru|Forester','Volkswagen|Tiguan','Jeep|Compass','Jeep|Cherokee','Mitsubishi|Outlander','Buick|Envision'],
 small_suv: ['Honda|HR-V','Toyota|Corolla Cross','Hyundai|Kona','Kia|Seltos','Nissan|Kicks','Chevrolet|Trax','Chevrolet|Trailblazer','Buick|Encore','Mazda|CX-30','Subaru|Crosstrek','Jeep|Renegade','Ford|EcoSport'],
 midsize_suv: ['Honda|Pilot','Toyota|Highlander','Hyundai|Palisade','Kia|Telluride','Ford|Explorer','Chevrolet|Traverse','GMC|Acadia','Nissan|Pathfinder','Mazda|CX-9','Mazda|CX-90','Subaru|Ascent','Volkswagen|Atlas','Jeep|Grand Cherokee','Dodge|Durango','Toyota|4Runner','Honda|Passport'],
 fullsize_suv: ['Chevrolet|Tahoe','Chevrolet|Suburban','GMC|Yukon','Ford|Expedition','Nissan|Armada','Toyota|Sequoia','Jeep|Wagoneer'],
 fullsize_truck: ['Ford|F-150','Ram|1500','Chevrolet|Silverado 1500','GMC|Sierra 1500','Toyota|Tundra','Nissan|Titan'],
 midsize_truck: ['Toyota|Tacoma','Ford|Ranger','Chevrolet|Colorado','GMC|Canyon','Nissan|Frontier','Honda|Ridgeline','Jeep|Gladiator'],
 heavy_truck: ['Ram|2500','Ram|3500','Ford|F-250','Ford|F-350','Chevrolet|Silverado 2500','Chevrolet|Silverado 3500','GMC|Sierra 2500','GMC|Sierra 3500'],
 luxury_sedan: ['BMW|3 Series','Mercedes-Benz|C-Class','Audi|A4','Lexus|IS','Acura|TLX','Infiniti|Q50','Cadillac|CT4','Genesis|G70'],
 large_luxury_sedan: ['Mercedes-Benz|E-Class','BMW|5 Series','Audi|A6','Lexus|ES','Lexus|GS','Genesis|G80','Volvo|S90','Cadillac|CT5'],
 flagship_sedan: ['Mercedes-Benz|S-Class','BMW|7 Series','Audi|A8','Lexus|LS','Genesis|G90'],
 luxury_suv: ['Mercedes-Benz|GLC-Class','BMW|X3','Audi|Q5','Lexus|NX','Acura|RDX','Volvo|XC60','Porsche|Macan','Infiniti|QX50'],
 large_luxury_suv: ['Mercedes-Benz|GLE-Class','BMW|X5','Audi|Q7','Lexus|RX','Acura|MDX','Volvo|XC90','Porsche|Cayenne','Infiniti|QX60'],
 ev: ['Tesla|Model 3','Tesla|Model S','BMW|i4','Hyundai|Ioniq 6','Nissan|Leaf','Chevrolet|Bolt EV','Polestar|2'],
 ev_suv: ['Tesla|Model Y','Tesla|Model X','Ford|Mustang Mach-E','Hyundai|Ioniq 5','Kia|EV6','Volkswagen|ID.4','Nissan|Ariya','Subaru|Solterra','Toyota|bZ4X'],
 minivan: ['Honda|Odyssey','Toyota|Sienna','Chrysler|Pacifica','Chrysler|Town and Country','Dodge|Grand Caravan','Kia|Carnival','Kia|Sedona','Nissan|Quest'],
};
export interface Competitor {makeSlug:string; modelSlug:string; name:string}
export function segmentCompetitors(makeSlug: string, modelSlug: string): Competitor[] {
 for (const models of Object.values(SEGMENTS)) {
  const vehicles = models.map(value=>{const [make,model]=value.split('|');return {makeSlug:slugify(make),modelSlug:slugify(model),name:`${make} ${model}`};});
  if (vehicles.some(v=>v.makeSlug===makeSlug && v.modelSlug===modelSlug)) return vehicles.filter(v=>v.makeSlug!==makeSlug || v.modelSlug!==modelSlug);
 }
 return [];
}
