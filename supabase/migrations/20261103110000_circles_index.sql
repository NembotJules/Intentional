-- US-091 · Advisors (performance): cover the circles.created_by foreign key.
create index if not exists circles_created_by on public.circles (created_by);
