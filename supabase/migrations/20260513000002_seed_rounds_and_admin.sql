-- Seed the round deadlines and the bootstrap admin email.
-- Dates are FIFA's tentative 2026 calendar; admin can edit from /admin/rounds.
-- All in UTC (Mexico City opener is 11 Jun 2026 around 18:00 local / 00:00 UTC next day).

insert into rounds (stage, locks_at) values
  ('group',        '2026-06-11 18:00:00+00'),
  ('r32',          '2026-06-29 16:00:00+00'),
  ('r16',          '2026-07-04 16:00:00+00'),
  ('qf',           '2026-07-09 20:00:00+00'),
  ('sf',           '2026-07-14 20:00:00+00'),
  ('third_place',  '2026-07-18 16:00:00+00'),
  ('final',        '2026-07-19 19:00:00+00')
on conflict (stage) do nothing;

-- Bootstrap admin (project owner). Future users get added via /admin/allowed-emails.
insert into allowed_emails (email, is_admin) values
  ('diegopedro1194@gmail.com', true)
on conflict (email) do update set is_admin = excluded.is_admin;
