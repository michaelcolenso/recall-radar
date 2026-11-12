import {WorkflowEntrypoint,WorkflowEvent,WorkflowStep} from 'cloudflare:workers';
import {runEnrichment,type EnrichmentParams} from '../lib/enrichment-runner';
export type {EnrichmentParams} from '../lib/enrichment-runner';
export class EnrichmentWorkflow extends WorkflowEntrypoint<Env,EnrichmentParams>{
 async run(event:WorkflowEvent<EnrichmentParams>,step:WorkflowStep){return runEnrichment(this.env,event.payload,step);}
}
