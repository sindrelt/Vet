CREATE TABLE chains (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE clinics (
 id text PRIMARY KEY, slug text UNIQUE NOT NULL, branch_key text UNIQUE NOT NULL, name text NOT NULL,
 chain_id text REFERENCES chains(id), municipality text NOT NULL,
 area text NOT NULL CHECK (area IN ('Modum','Ringerike','Øvre Eiker','Nedre Eiker','Drammen')),
 place text NOT NULL, address text NOT NULL, postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{4}$'),
 phone text, website text NOT NULL CHECK (website LIKE 'https://%'), verified_at timestamptz NOT NULL,
 CHECK (area <> 'Nedre Eiker' OR municipality = 'Drammen')
);
CREATE TABLE treatments (
 id text PRIMARY KEY, category text NOT NULL CHECK (category IN ('Konsultasjon','Vaksinasjon','ID-merking','Kastrering')),
 species text NOT NULL CHECK (species IN ('dog','cat')), sex text NOT NULL CHECK (sex IN ('any','male','female')),
 weight_min_grams integer CHECK (weight_min_grams >= 0), weight_max_grams integer CHECK (weight_max_grams > 0),
 package_key text NOT NULL, package_label text NOT NULL,
 CHECK (weight_max_grams IS NULL OR weight_max_grams > COALESCE(weight_min_grams,0)),
 UNIQUE NULLS NOT DISTINCT (category,species,sex,weight_min_grams,weight_max_grams,package_key)
);
CREATE TABLE sources (
 id text PRIMARY KEY, clinic_id text REFERENCES clinics(id) NOT NULL, url text UNIQUE NOT NULL CHECK (url LIKE 'https://%'),
 adapter text NOT NULL CHECK (adapter IN ('html-table','pdf-lines')), config jsonb NOT NULL,
 terms_url text NOT NULL, terms_reviewed_at timestamptz NOT NULL, terms_note text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, last_attempt_at timestamptz, last_success_at timestamptz, last_error text
);
-- JSON snapshot preserves the complete source description and precise integer øre amounts.
CREATE FUNCTION valid_price_snapshot(s jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(
  jsonb_typeof(s->'originalName') = 'string' AND length(s->>'originalName') > 1 AND
  jsonb_typeof(s->'originalText') = 'string' AND length(s->>'originalText') > 2 AND
  (s->>'sourceUrl') LIKE 'https://%' AND
  jsonb_typeof(s->'includes') = 'array' AND jsonb_typeof(s->'extras') = 'array' AND jsonb_typeof(s->'caveats') = 'array' AND
  (s->>'vat') IN ('included','excluded','unspecified') AND
  CASE s->'price'->>'kind'
   WHEN 'unknown' THEN s->'price'->'minOre' = 'null'::jsonb AND s->'price'->'maxOre' = 'null'::jsonb
   WHEN 'fixed' THEN (s->'price'->>'minOre') ~ '^[0-9]+$' AND (s->'price'->>'minOre')::bigint BETWEEN 1 AND 100000000 AND s->'price'->'maxOre' = 'null'::jsonb
   WHEN 'from' THEN (s->'price'->>'minOre') ~ '^[0-9]+$' AND (s->'price'->>'minOre')::bigint BETWEEN 1 AND 100000000 AND s->'price'->'maxOre' = 'null'::jsonb
   WHEN 'range' THEN (s->'price'->>'minOre') ~ '^[0-9]+$' AND (s->'price'->>'maxOre') ~ '^[0-9]+$' AND (s->'price'->>'minOre')::bigint BETWEEN 1 AND 100000000 AND (s->'price'->>'maxOre')::bigint BETWEEN (s->'price'->>'minOre')::bigint AND 100000000
   ELSE false END, false);
$$;
CREATE TABLE offers (
 id text PRIMARY KEY, clinic_id text REFERENCES clinics(id) NOT NULL, treatment_id text REFERENCES treatments(id) NOT NULL,
 source_id text REFERENCES sources(id) NOT NULL, snapshot jsonb NOT NULL CHECK (valid_price_snapshot(snapshot)), content_hash text NOT NULL,
 fetched_at timestamptz NOT NULL, checked_at timestamptz NOT NULL, published_at timestamptz NOT NULL,
 CONSTRAINT offer_branch_treatment UNIQUE(clinic_id,treatment_id)
);
CREATE TABLE proposals (
 id text PRIMARY KEY, clinic_id text REFERENCES clinics(id) NOT NULL, treatment_id text REFERENCES treatments(id) NOT NULL,
 source_id text REFERENCES sources(id) NOT NULL, snapshot jsonb NOT NULL CHECK (valid_price_snapshot(snapshot)),
 content_hash text NOT NULL, base_hash text, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 fetched_at timestamptz NOT NULL, checked_at timestamptz NOT NULL, reviewed_at timestamptz, reviewed_by text, review_note text,
 CONSTRAINT proposal_content UNIQUE(clinic_id,treatment_id,content_hash)
);
CREATE INDEX proposals_status ON proposals(status, fetched_at);
CREATE TABLE price_history (
 id text PRIMARY KEY, offer_id text REFERENCES offers(id) NOT NULL, proposal_id text UNIQUE REFERENCES proposals(id) NOT NULL,
 snapshot jsonb NOT NULL CHECK (valid_price_snapshot(snapshot)), published_at timestamptz NOT NULL, reviewed_by text NOT NULL
);
