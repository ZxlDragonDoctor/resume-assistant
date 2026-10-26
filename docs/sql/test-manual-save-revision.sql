-- Run after init.sql or migrate-manual-save-revision.sql:
-- psql -v ON_ERROR_STOP=1 -d resume_assistant -f docs/sql/test-manual-save-revision.sql
-- Tests only temporary rows; no application data is changed.
BEGIN;
CREATE TEMP TABLE manual_save_revision_test (LIKE resumes INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE TRIGGER test_resume_revision BEFORE INSERT OR UPDATE ON manual_save_revision_test
    FOR EACH ROW EXECUTE FUNCTION touch_resume_content_revision();

DO $$
DECLARE
    test_id UUID := gen_random_uuid();
    revision timestamptz;
    changed timestamptz;
    created timestamptz;
    missing_both_id UUID := gen_random_uuid();
    missing_created_id UUID := gen_random_uuid();
BEGIN
    -- Reproduce legacy MyBatis fill annotations binding explicit NULLs rather
    -- than omitting timestamp columns and allowing their defaults to run.
    INSERT INTO manual_save_revision_test(id, user_id, title, created_at, updated_at)
        VALUES(test_id, gen_random_uuid(), 'Original', NULL, NULL)
        RETURNING created_at, updated_at INTO created, revision;
    IF created IS NULL OR revision IS NULL THEN RAISE EXCEPTION 'Explicit NULL timestamp inserts must receive created_at and a save token'; END IF;

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

    -- Simulate rows written before the INSERT protection was installed.
    ALTER TABLE manual_save_revision_test DISABLE TRIGGER test_resume_revision;
    INSERT INTO manual_save_revision_test(id, user_id, created_at, updated_at)
        VALUES(missing_both_id, gen_random_uuid(), NULL, NULL),
              (missing_created_id, gen_random_uuid(), NULL, revision);
    ALTER TABLE manual_save_revision_test ENABLE TRIGGER test_resume_revision;
    UPDATE manual_save_revision_test
    SET created_at = COALESCE(created_at, updated_at, clock_timestamp()),
        updated_at = COALESCE(updated_at, created_at, clock_timestamp())
    WHERE created_at IS NULL OR updated_at IS NULL;
    IF EXISTS (SELECT 1 FROM manual_save_revision_test WHERE created_at IS NULL OR updated_at IS NULL)
        THEN RAISE EXCEPTION 'Legacy NULL timestamp rows must be backfilled'; END IF;
    SELECT updated_at INTO changed FROM manual_save_revision_test WHERE id = missing_created_id;
    IF changed IS DISTINCT FROM revision THEN RAISE EXCEPTION 'Repairing created_at must preserve a valid content revision'; END IF;

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
