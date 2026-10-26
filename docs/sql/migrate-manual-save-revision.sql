-- Existing installations: psql -v ON_ERROR_STOP=1 -d resume_assistant -f docs/sql/migrate-manual-save-revision.sql
-- Keep updated_at as a content revision. Viewing or sharing a resume must not
-- invalidate an editor's expectedUpdatedAt. This migration preserves all data.
BEGIN;

CREATE OR REPLACE FUNCTION touch_resume_content_revision() RETURNS trigger AS $$
BEGIN
    IF ROW(NEW.title, NEW.template_id, NEW.target_job, NEW.target_company,
           NEW.font_family, NEW.font_size, NEW.theme_color, NEW.line_spacing,
           NEW.layout_config, NEW.status)
       IS DISTINCT FROM
       ROW(OLD.title, OLD.template_id, OLD.target_job, OLD.target_company,
           OLD.font_family, OLD.font_size, OLD.theme_color, OLD.line_spacing,
           OLD.layout_config, OLD.status)
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at = GREATEST(clock_timestamp(),
            COALESCE(OLD.updated_at, '-infinity'::timestamptz) + INTERVAL '1 microsecond');
    ELSE
        NEW.updated_at = OLD.updated_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resumes_touch ON resumes;
CREATE TRIGGER trg_resumes_touch BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION touch_resume_content_revision();

COMMIT;
