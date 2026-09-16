-- Google Maps worker schema.
-- This worker owns these tables directly; Jamot Core reads them (or a view
-- over them) but does not write to them, so the worker can evolve its own
-- schema without coordinating a migration in packages/core.

create table if not exists maps_geo_cells (
  geo_cell_id      uuid primary key default gen_random_uuid(),
  center_lat       double precision not null,
  center_lng       double precision not null,
  radius_km        double precision not null,
  country          text not null,
  region           text,
  province         text,
  city             text,
  category         text,
  last_scanned_at  timestamptz,
  coverage_status  text not null default 'not_scanned'
                      check (coverage_status in
                        ('not_scanned','queued','scanning','partial','complete','needs_subdivision'))
);

create table if not exists maps_jobs (
  job_id            uuid primary key default gen_random_uuid(),
  job_type          text not null default 'google_maps_discovery',
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  status            text not null default 'queued'
                       check (status in ('queued','running','paused','completed','partial','failed','cancelled')),
  query             text not null,
  country           text not null,
  region            text,
  province          text,
  city              text,
  category          text,
  geo_cell_id       uuid references maps_geo_cells(geo_cell_id),
  results_found     integer not null default 0,
  new_records       integer not null default 0,
  duplicate_records integer not null default 0,
  errors            jsonb not null default '[]',
  worker_id         text
);

create table if not exists maps_raw_scrape_results (
  id               bigserial primary key,
  job_id           uuid not null references maps_jobs(job_id),
  provider         text not null,
  provider_version text,
  raw_payload      jsonb not null,
  scraped_at       timestamptz not null default now()
);

create table if not exists maps_companies (
  company_id    uuid primary key default gen_random_uuid(),
  name          text not null,
  website       text,
  domain        text,
  phone         text,
  email         text,
  company_type  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists maps_locations (
  location_id             uuid primary key default gen_random_uuid(),
  company_id              uuid not null references maps_companies(company_id),
  google_place_id         text unique,
  name                    text not null,
  address                 text,
  street                  text,
  city                    text,
  province                text,
  postal_code             text,
  country                 text,
  latitude                double precision,
  longitude               double precision,
  phone                   text,
  website                 text,
  category                text,
  rating                  real,
  review_count            integer,
  opening_hours           jsonb,
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),
  last_verified_at        timestamptz,
  source                  text not null default 'google_maps',
  possible_duplicate      boolean not null default false,
  pos_potential           text not null default 'unknown'
                             check (pos_potential in ('unknown','likely','verified')),
  pos_status              text,
  pos_status_source       text,
  pos_status_confidence   real
);

create index if not exists maps_locations_phone_idx on maps_locations (phone);
create index if not exists maps_locations_domain_idx on maps_locations (website);
create index if not exists maps_geo_cells_area_idx
  on maps_geo_cells (country, region, province, city, category);

-- Which job first produced or re-touched which location, so GET
-- /jobs/:id/results can answer "what did this job find" without re-deriving
-- it from raw_scrape_results. A location can appear under several jobs
-- (dedup re-touches on refresh), hence the composite key rather than a
-- single job_id column on maps_locations.
create table if not exists maps_job_results (
  job_id      uuid not null references maps_jobs(job_id),
  location_id uuid not null references maps_locations(location_id),
  outcome     text not null check (outcome in ('new','duplicate','possible_duplicate')),
  created_at  timestamptz not null default now(),
  primary key (job_id, location_id)
);
