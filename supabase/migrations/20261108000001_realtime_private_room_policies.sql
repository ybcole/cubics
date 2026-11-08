-- M02/M03 staging candidate: Supabase private Realtime channel authorization.
-- DO NOT apply to the populated Cubics Supabase project before review, backup,
-- Clerk third-party auth configuration, and isolated-staging negative tests.
--
-- Core Prisma tables are PascalCase and use Clerk string user IDs.
-- Keep anon/authenticated table grants revoked: this SECURITY DEFINER
-- function checks membership without exposing the underlying records.
-- NOTE: SECURITY DEFINER function owner must be able to read Room/RoomMember.

create or replace function public.cubics_can_subscribe_room(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select topic like 'cubics:room:%'
    and char_length(topic) between 14 and 160
    and nullif(auth.jwt() ->> 'sub', '') is not null
    and exists (
      select 1 from public."Room" r
      where r.id = substr(topic, length('cubics:room:') + 1)
        and (
          r."ownerId" = (auth.jwt() ->> 'sub')
          or exists (
            select 1 from public."RoomMember" rm
            where rm."roomId" = r.id
              and rm."userId" = (auth.jwt() ->> 'sub')
          )
        )
    );
$$;

revoke all on function public.cubics_can_subscribe_room(text) from public, anon;
grant execute on function public.cubics_can_subscribe_room(text) to authenticated;

-- Broadcast + Presence are *ephemeral* only. Authoritative widget changes
-- must be committed through authenticated Next API and durable revisions.
-- SELECT and INSERT permissions are both necessary for private channels.
drop policy if exists cubics_room_realtime_read on realtime.messages;
create policy cubics_room_realtime_read
  on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.cubics_can_subscribe_room(realtime.topic())
  );

drop policy if exists cubics_room_realtime_write on realtime.messages;
create policy cubics_room_realtime_write
  on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.cubics_can_subscribe_room(realtime.topic())
  );

-- realtime.messages RLS is already enabled by Supabase. DO NOT issue an
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY here (owner privilege failure).
-- Rollback on isolated staging: drop the two policies and the function.
