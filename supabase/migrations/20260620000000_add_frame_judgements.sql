-- Phase 1 of the structural-consistency judge.
-- frame_judgements: per-frame verdict array (parallel to generated_frames).
-- review_decisions: append-only log of reviewer keep/regenerate decisions,
--   used later to calibrate the score threshold and validate the judge.
alter table jobs add column if not exists frame_judgements jsonb;
alter table jobs add column if not exists review_decisions jsonb;
