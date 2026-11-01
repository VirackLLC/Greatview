\set ON_ERROR_STOP on
insert into app_private.site_editors(user_id, role)
values ('22222222-2222-4222-a222-222222222222', 'editor');
do $$ begin
  insert into app_private.site_editors(user_id, role) values ('44444444-4444-4444-a444-444444444444', 'owner');
  raise exception 'second permanent owner accepted';
exception when unique_violation then raise notice 'PASS: only one permanent owner can be configured'; end $$;
do $$ begin
  insert into app_private.site_editors(user_id, role) values ('44444444-4444-4444-a444-444444444444', 'editor');
  raise exception 'second temporary editor accepted';
exception when unique_violation then raise notice 'PASS: only one temporary editor can be configured'; end $$;
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
set role anon;
select public.test_assert((select count(*) = 1 from public.site_content), 'anonymous visitors can read published content');
do $$ begin
  perform public.publish_site('{}', 1);
  raise exception 'anonymous publish unexpectedly allowed';
exception when insufficient_privilege then raise notice 'PASS: anonymous publishing denied'; end $$;
do $$ begin
  insert into storage.objects(bucket_id, name) values ('site-photos', '11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp');
  raise exception 'anonymous upload unexpectedly allowed';
exception when insufficient_privilege then raise notice 'PASS: anonymous uploads denied'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-a333-333333333333', false);
select public.test_assert(not public.can_edit_site(), 'unapproved account cannot edit');
do $$ begin
  perform public.publish_site((select content from public.site_content where id=1), 1);
  raise exception 'unapproved account publish unexpectedly allowed';
exception when insufficient_privilege then raise notice 'PASS: unapproved account publishing denied'; end $$;
do $$ begin
  insert into storage.objects(bucket_id, name) values ('site-photos', '33333333-3333-4333-a333-333333333333/33333333-3333-4333-a333-333333333333.webp');
  raise exception 'unapproved account upload unexpectedly allowed';
exception when insufficient_privilege then raise notice 'PASS: unapproved account uploads denied'; end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-a222-222222222222', false);
select public.test_assert(public.has_site_access(), 'temporary editor is on the private allowlist');
select public.test_assert(public.needs_password_change(), 'temporary editor must change the initial password');
select public.test_assert(not public.can_edit_site(), 'temporary editor cannot edit before changing the initial password');
select public.test_assert(public.complete_password_setup(), 'temporary editor can complete their own password setup');
select public.test_assert(public.can_edit_site(), 'temporary editor is authorized after password setup');
select public.test_assert(not public.is_site_owner(), 'temporary editor is not the permanent owner');
do $$ begin
  perform public.temporary_editor_active();
  raise exception 'temporary editor inspected owner-only access';
exception when insufficient_privilege then raise notice 'PASS: temporary editor cannot inspect owner access'; end $$;
do $$ begin
  perform public.remove_temporary_editor();
  raise exception 'temporary editor removed their own access';
exception when insufficient_privilege then raise notice 'PASS: temporary editor cannot remove access'; end $$;
select public.test_assert(
  public.publish_site(jsonb_set((select content from public.site_content where id=1), '{serviceArea,region}', '"East Valley"'), 1) = 2,
  'temporary editor can publish a service-area edit'
);
insert into storage.objects(bucket_id, name) values ('site-photos', '22222222-2222-4222-a222-222222222222/33333333-3333-4333-a333-333333333333.webp');
do $$ begin
  insert into storage.objects(bucket_id, name) values ('site-photos', '11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp');
  raise exception 'editor uploaded to another account folder';
exception when insufficient_privilege then raise notice 'PASS: editor can only upload to own folder'; end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', false);
select public.test_assert(public.has_site_access(), 'permanent owner is on the private allowlist');
select public.test_assert(public.needs_password_change(), 'permanent owner must change the initial password');
select public.test_assert(not public.can_edit_site(), 'permanent owner cannot edit before changing the initial password');
select public.test_assert(public.complete_password_setup(), 'permanent owner can complete their own password setup');
select public.test_assert(public.can_edit_site(), 'permanent owner is authorized after password setup');
select public.test_assert(public.is_site_owner(), 'permanent owner recognized');
select public.test_assert(public.temporary_editor_active(), 'permanent owner can check temporary access');
do $$ begin
  update public.site_content set content = '{}';
  raise exception 'direct update unexpectedly allowed';
exception when insufficient_privilege then raise notice 'PASS: owner cannot bypass publish validation'; end $$;
do $$ begin
  select user_id from app_private.site_editors;
  raise exception 'editor table unexpectedly exposed';
exception when insufficient_privilege then raise notice 'PASS: editor account mapping is private'; end $$;
select public.test_assert(public.publish_site((select content from public.site_content where id=1), 2) = 3, 'owner can publish original content');
do $$ begin
  perform public.publish_site((select content from public.site_content where id=1), 2);
  raise exception 'stale version unexpectedly saved';
exception when serialization_failure then raise notice 'PASS: conflicting saves rejected'; end $$;
do $$ begin
  perform public.publish_site(jsonb_set((select content from public.site_content where id=1), '{hero}', '"javascript:alert(1)"'), 3);
  raise exception 'unsafe photo URL accepted';
exception when invalid_parameter_value then raise notice 'PASS: unsafe photo URL rejected'; end $$;
do $$ begin
  perform public.publish_site(jsonb_set((select content from public.site_content where id=1), '{license}', '{"businessName":"Test only","number":"123","verificationUrl":""}'), 3);
  raise exception 'invalid license accepted';
exception when invalid_parameter_value then raise notice 'PASS: incomplete license rejected'; end $$;
do $$ begin
  perform public.publish_site(jsonb_set((select content from public.site_content where id=1), '{serviceArea,region}', '""'), 3);
  raise exception 'blank service area accepted';
exception when invalid_parameter_value then raise notice 'PASS: blank service area rejected'; end $$;
do $$ begin
  perform public.publish_site(jsonb_set((select content from public.site_content where id=1), '{serviceArea,cities}', '["Mesa"," mesa "]'), 3);
  raise exception 'duplicate service-area cities accepted';
exception when invalid_parameter_value then raise notice 'PASS: duplicate service-area cities rejected'; end $$;
select public.test_assert(public.publish_site(jsonb_set((select content from public.site_content where id=1), '{license}', '{"businessName":"Policy test only","number":"001234","verificationUrl":"https://azroc.my.site.com/AZRoc/s/contractor-search"}'), 3) = 4, 'owner can publish leading-zero ROC number and official portal link');
select public.test_assert(public.publish_site((select content from public.site_content where id=1) || '{"hero":null,"featured":null,"services":[null,null,null,null,null],"gallery":[]}', 4) = 5, 'owner can delete all photos without empty URLs');
insert into storage.objects(bucket_id, name) values ('site-photos', '11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp');
do $$ begin
  insert into storage.objects(bucket_id, name) values ('22222222-2222-4222-a222-222222222222', '11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp');
  raise exception 'wrong bucket accepted';
exception when insufficient_privilege then raise notice 'PASS: wrong bucket rejected'; end $$;
do $$ begin
  insert into storage.objects(bucket_id, name) values ('site-photos', '11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.html');
  raise exception 'HTML upload accepted';
exception when insufficient_privilege then raise notice 'PASS: non-WebP upload name rejected'; end $$;
delete from storage.objects;
reset role;
select public.test_assert((select count(*) = 2 from storage.objects), 'files cannot be accidentally deleted by the browser');

set role authenticated;
select public.test_assert(public.remove_temporary_editor(), 'permanent owner can remove the temporary editor');
select public.test_assert(public.can_edit_site() and public.is_site_owner(), 'removing the temporary editor leaves owner access intact');
select public.test_assert((select version = 5 from public.site_content), 'revoking the editor preserves published content');
reset role;
set role anon;
select public.test_assert((select content->'license'->>'number' = '001234' and version=5 from public.site_content), 'public visitors see the saved license and current version');
select public.test_assert((select content->'serviceArea'->>'region' = 'East Valley' from public.site_content), 'public visitors see the published service area');
reset role;
