-- Run after init.sql or migrate-manual-save-revision.sql:
-- psql -v ON_ERROR_STOP=1 -d resume_assistant -f docs/sql/test-manual-save-revision.sql
-- Tests only temporary rows; no application data is changed.
BEGIN;
CREATE TEMP TABLE manual_save_revision_test (LIKE resumes INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TRIGGER test_resume_revision BEFORE UPDATE ON manual_save_revision_test
    FOR EACH ROW EXECUTE FUNCTION touch_resume_content_revision();

DO $$
DECLARE
    test_id UUID := gen_random_uuid();
    revision timestamptz;
    changed timestamptz;
BEGIN
    INSERT INTO manual_save_revision_test(id, user_id, title, updated_at)
        VALUES(test_id, gen_random_uuid(), 'Original', clock_timestamp()) RETURNING updated_at INTO revision;

    UPDATE manual_save_revision_test SET view_count = 1 WHERE id = test_id RETURNING updated_at INTO changed;
    IF changed IS DISTINCT FROM revision THEN RAISE EXCEPTION 'A view must not change the content revision'; END IF;

    UPDATE manual_save_revision_test SET share_enabled = TRUE, share_token = 'test-token', is_public = TRUE
        WHERE id = test_id RETURNING updated_at INTO changed;
    IF changed IS DISTINCT FROM revision THEN RAISE EXCEPTION 'Sharing must not change the content revision'; END IF;

    UPDATE manual_save_revision_test SET title = 'Changed' WHERE id = test_id RETURNING updated_at INTO changed;
    IF changed <= revision THEN RAISE EXCEPTION 'Content changes must advance the revision'; END IF;
    revision := changed;

    UPDATE manual_save_revision_test SET updated_at = GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond')
        WHERE id = test_id RETURNING updated_at INTO changed;
    IF changed <= revision THEN RAISE EXCEPTION 'Explicit section/manual-save touches must advance the revision'; END IF;
    revision := changed;

    UPDATE manual_save_revision_test SET title = 'Changed' WHERE id = test_id RETURNING updated_at INTO changed;
    IF changed IS DISTINCT FROM revision THEN RAISE EXCEPTION 'An unrelated no-op must preserve the revision'; END IF;

    -- A clock adjustment or a transaction started before a preceding writer
    -- must never cause the content revision to move backward.
    test_id := gen_random_uuid();
    INSERT INTO manual_save_revision_test(id, user_id, title, updated_at)
        VALUES(test_id, gen_random_uuid(), 'Future', clock_timestamp() + INTERVAL '1 day') RETURNING updated_at INTO revision;
    UPDATE manual_save_revision_test SET title = 'Future changed' WHERE id = test_id RETURNING updated_at INTO changed;
    IF changed <> revision + INTERVAL '1 microsecond' THEN RAISE EXCEPTION 'Revision must be monotonic beyond wall-clock time'; END IF;
END;
$$;
ROLLBACK;
