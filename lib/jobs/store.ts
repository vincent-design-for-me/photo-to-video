// Route all store calls through Cloudflare D1 when configured, or local JSON store for offline dev/tests.
import * as local from "./store.local";
import * as d1 from "./store.d1";
import { isD1Configured } from "../cloudflare/config";

function store() {
  return isD1Configured() ? d1 : local;
}

export type { ClaimExecutionOptions, ClaimResult, JobPatch } from "./store.d1";

export const ensureJobDirs: typeof local.ensureJobDirs = (...args) => store().ensureJobDirs(...args);
export const createJob: typeof local.createJob = (...args) => store().createJob(...args);
export const getJob: typeof local.getJob = (...args) => store().getJob(...args);
export const writeJob: typeof local.writeJob = (...args) => store().writeJob(...args);
export const mutateJob: typeof local.mutateJob = (...args) => store().mutateJob(...args);
export const claimJobExecution: typeof local.claimJobExecution = (...args) => store().claimJobExecution(...args);
export const claimFrameRegeneration: typeof local.claimFrameRegeneration = (...args) => store().claimFrameRegeneration(...args);
export const updateJobStep: typeof local.updateJobStep = (...args) => store().updateJobStep(...args);
export const buildJobAsset: typeof local.buildJobAsset = (...args) => store().buildJobAsset(...args);
export const getJobsByUser: typeof local.getJobsByUser = (...args) => store().getJobsByUser(...args);
