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
select public.test_assert(
  public.publish_site(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          (select content from public.site_content where id=1),
          '{services,0,photos}',
          jsonb_build_array(jsonb_build_object(
            'id','album-photo-a',
            'url','https://testproject.supabase.co/storage/v1/object/public/site-photos/11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp',
            'caption','Finished patio'
          ))
        ),
        '{services,0,coverPhotoId}',
        '"album-photo-a"'::jsonb
      ),
      '{services,0,image}',
      '"https://testproject.supabase.co/storage/v1/object/public/site-photos/11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp"'::jsonb
    ),
    4
  ) = 5,
  'owner can publish a service album with a cover and caption'
);
do $$ begin
  perform public.publish_site(
    jsonb_set((select content from public.site_content where id=1), '{services,0,photos,0,url}', '"https://evil.test/photo.webp"'::jsonb),
    5
  );
  raise exception 'unsafe service photo URL accepted';
exception when invalid_parameter_value then raise notice 'PASS: unsafe service photo URL rejected'; end $$;
do $$ begin
  perform public.publish_site(
    jsonb_set((select content from public.site_content where id=1), '{services,0,coverPhotoId}', '"missing-photo"'::jsonb),
    5
  );
  raise exception 'missing service cover accepted';
exception when invalid_parameter_value then raise notice 'PASS: service cover must belong to the album'; end $$;
select public.test_assert(
  public.publish_site(
    jsonb_set(
      (select content from public.site_content where id=1),
      '{services}',
      (select jsonb_agg(value) from jsonb_array_elements((select content->'services' from public.site_content where id=1))
       where value->>'title' <> 'Irrigation')
      || jsonb_build_array(jsonb_build_object('id','service-new','title','Outdoor Kitchens','description','Built for Arizona evenings.','icon','grid','image',null,'photos','[]'::jsonb,'coverPhotoId',null))
    ),
    5
  ) = 6,
  'owner can add and remove services while preserving their content'
);
do $$ begin
  perform public.publish_site(
    jsonb_set((select content from public.site_content where id=1), '{services,0,title}', '""'::jsonb),
    6
  );
  raise exception 'blank service title accepted';
exception when invalid_parameter_value then raise notice 'PASS: blank service titles rejected'; end $$;
do $$ begin
  perform public.publish_site(
    jsonb_set((select content from public.site_content where id=1), '{services,0,description}', '" "'::jsonb),
    6
  );
  raise exception 'blank service description accepted';
exception when invalid_parameter_value then raise notice 'PASS: blank service descriptions rejected'; end $$;
select public.test_assert(
  public.publish_site(
    jsonb_set(
      (select content from public.site_content where id=1),
      '{services}',
      (select jsonb_agg(
        jsonb_set(
          jsonb_set(
            jsonb_set(value, '{image}', 'null'::jsonb),
            '{photos}', '[]'::jsonb
          ),
          '{coverPhotoId}', 'null'::jsonb
        )
      ) from jsonb_array_elements((select content->'services' from public.site_content where id=1)))
    ) || '{"hero":null,"featured":null,"gallery":[]}',
    6
  ) = 7,
  'owner can remove all photos without empty URLs'
);
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
select public.test_assert((select version = 7 from public.site_content), 'revoking the editor preserves published content');
reset role;
set role anon;
select public.test_assert((select content->'license'->>'number' = '001234' and version=7 from public.site_content), 'public visitors see the saved license and current version');
select public.test_assert((select content->'serviceArea'->>'region' = 'East Valley' from public.site_content), 'public visitors see the published service area');
reset role;

-- Save beyond both former photo counts and the old 250 KB content ceiling.
-- Roll back this fixture so the earlier published test content stays unchanged.
begin;
set local role authenticated;
do $$
declare doc jsonb; photos jsonb; photo_url text := 'https://testproject.supabase.co/storage/v1/object/public/site-photos/11111111-1111-4111-a111-111111111111/33333333-3333-4333-a333-333333333333.webp'; old_version integer; next_version integer;
begin
  select content, version into doc, old_version from public.site_content where id=1;
  select jsonb_agg(jsonb_build_object('id','photo-'||i,'url',photo_url,'caption','')) into photos from generate_series(1,1500) i;
  doc := jsonb_set(doc, '{services,0,photos}', photos);
  doc := jsonb_set(doc, '{services,0,image}', to_jsonb(photo_url));
  doc := jsonb_set(doc, '{services,0,coverPhotoId}', '"photo-1"');
  doc := jsonb_set(doc, '{gallery}', (select jsonb_agg(jsonb_build_object('id','gallery-'||i,'url',photo_url,'title','Project')) from generate_series(1,100) i));
  assert octet_length(doc::text)>250000, 'fixture must exceed the old content-size limit';
  next_version := public.publish_site(doc, old_version);
  assert next_version=old_version+1, 'large photo collection did not save';
  assert (select jsonb_array_length(content->'services'->0->'photos')=1500 and jsonb_array_length(content->'gallery')=100 from public.site_content where id=1), 'large photo collection did not persist';
  begin
    perform public.publish_site(jsonb_set(doc, '{services,0,photos,1,url}', '"https://evil.test/photo.webp"'), next_version);
    raise exception 'unsafe URL accepted in large album';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'PASS: 1500 service photos and 100 gallery photos save; unsafe photos still rejected';
end;
$$;
rollback;
