// Route all store calls through the correct implementation based on env.
// Import both at build time; the isSupabaseMode() check happens at call time.
import * as local from "./store.local";
import * as supabase from "./store.supabase";
import { isSupabaseMode } from "../supabase";

function store() {
  return isSupabaseMode() ? supabase : local;
}

export const ensureJobDirs: typeof local.ensureJobDirs = (...args) => store().ensureJobDirs(...args);
export const createJob: typeof local.createJob = (...args) => store().createJob(...args);
export const getJob: typeof local.getJob = (...args) => store().getJob(...args);
export const writeJob: typeof local.writeJob = (...args) => store().writeJob(...args);
export const updateJobStep: typeof local.updateJobStep = (...args) => store().updateJobStep(...args);
export const buildJobAsset: typeof local.buildJobAsset = (...args) => store().buildJobAsset(...args);
