begin;
-- Acknowledging the end and the minimum review duration are independent.
alter table spinout_private.terms_acceptances drop constraint terms_acceptances_check;
alter table spinout_private.terms_acceptances add constraint terms_acceptances_check
 check(bottom_at>=reviewed_at and accepted_at>=bottom_at and accepted_at>=reviewed_at+interval '12 seconds');

create or replace function spinout_private.accept_terms(p_version text,p_hash text,p_review_id uuid,p_agreed boolean) returns void
 language plpgsql security definer set search_path='' as $$
declare review spinout_private.terms_reviews;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if p_agreed is distinct from true then raise exception 'Choose whether to agree';end if;
 if not exists(select 1 from spinout_private.terms_documents where active and version=p_version and content_hash=p_hash) then raise exception 'Terms changed; refresh the page';end if;
 select * into review from spinout_private.terms_reviews where review_id=p_review_id and auth_user_id=auth.uid() and version=p_version for update;
 if not found or review.opened_at<clock_timestamp()-interval '1 hour' or review.bottom_at is null then raise exception 'Open and scroll through the Terms first';end if;
 if clock_timestamp()<review.opened_at+interval '12 seconds' then raise exception 'Wait 12 seconds after opening the Terms';end if;
 insert into spinout_private.terms_acceptances(auth_user_id,version,content_hash,reviewed_at,bottom_at)
 values(auth.uid(),p_version,p_hash,review.opened_at,review.bottom_at) on conflict do nothing;
end $$;
commit;
