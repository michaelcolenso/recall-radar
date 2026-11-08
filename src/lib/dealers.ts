const MOPAR='https://www.mopar.com/en-us/my-vehicle/recalls/search.html';
const GM='https://www.gm.com/recall-updates';
// Official OEM recall/service entry points; reviewed November 2026.
const OEM: Record<string,string> = {
 toyota:'https://www.toyota.com/recall/',lexus:'https://www.toyota.com/recall/',
 ford:'https://www.ford.com/support/recalls/',lincoln:'https://www.lincoln.com/support/recalls/',
 ram:MOPAR,dodge:MOPAR,jeep:MOPAR,chrysler:MOPAR,
 chevrolet:GM,gmc:GM,buick:GM,cadillac:GM,
 'mercedes-benz':'https://www.mbusa.com/en/recall',
 volkswagen:'https://www.vw.com/en/owners-and-services/about-my-vehicle/recalls.html',
};
export function officialRecallUrl(makeSlug: string): string | undefined {return OEM[makeSlug];}
export function recallServiceDetails(remedy: string): {phone?:string;code?:string} {
 return {phone:remedy.match(/\b1[- .]?\d{3}[- .]?\d{3}[- .]?\d{4}\b/)?.[0], code:remedy.match(/(?:recall\s+(?:number|numbers|code)|(?:manufacturer|FCA)(?:'s)?\s+recall(?:\s+(?:number|code))?)\s*(?:is|are|:|#)?\s*([A-Z0-9][A-Z0-9-]{1,14})\b/i)?.[1]};
}
