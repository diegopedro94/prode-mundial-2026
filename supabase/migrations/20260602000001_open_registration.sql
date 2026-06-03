-- =========================================================================
-- Open registration: anyone with Google can sign up.
--
-- We keep the `allowed_emails` table because it still drives the is_admin
-- flag on the profile created at signup. New users that don't have a row
-- there land with is_admin=false (default) — that's it.
-- =========================================================================

-- Drop the whitelist gate. The auth.users insert no longer rejects emails
-- not in allowed_emails.
drop trigger if exists trg_auth_users_email_whitelist on auth.users;
drop function if exists public.enforce_email_whitelist();

-- `handle_new_user` already looks up `allowed_emails` and falls back to
-- is_admin=false when the email isn't there, so no change needed.

-- Add an optional intro field on matches so the admin can save the pre-match
-- WhatsApp banter that goes above the auto-generated predictions reveal.
alter table matches
  add column if not exists summary_intro text;

comment on column matches.summary_intro is
  'Free-form intro the admin writes for the WhatsApp summary of this match. The reveal of predictions is generated automatically below it.';
