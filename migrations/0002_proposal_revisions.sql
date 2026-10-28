-- A price may legitimately return to an earlier amount. Only pending proposals
-- are deduplicated; history is append-only for each approved revision.
ALTER TABLE proposals DROP CONSTRAINT proposal_content;
CREATE UNIQUE INDEX proposal_pending_content ON proposals(clinic_id,treatment_id,content_hash) WHERE status='pending';
