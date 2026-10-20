# Resume template content implementation plan

Approved design: `docs/superpowers/specs/2026-10-19-resume-template-content-design.md`.

Goal: deliver 24 editable role samples, matching template previews and creation, then commit and deploy to the existing production server.

Architecture: role JSON files are the reviewed content source. A generator validates them and creates an idempotent SQL migration plus the initialization seed. Runtime reads `templates.preview_config`; the frontend and resume creation consume the same section data. Existing resumes and custom templates retain their content.

Tech stack: Java 17 / Spring Boot / MyBatis, PostgreSQL JSONB, React 18 / TypeScript / Ant Design, existing resume preview and PDF engines.

## Shared data contract

Each catalog record has `key`, `name`, `description`, `category`, `tags`, `sortOrder`, `legacyNames`, `config`, and `sample`.

`sample` has `version: 1`, `profile: { key, jobTitle, experienceLevel, highlights, suggestedPages }`, and `sections: [{ sectionType, sortOrder, layout, data }]`. `data` uses existing editable fields; module captions are in `_config.moduleName`. Contacts are fictional. Skills use supported grouped items. All sample modules are copied into new UUID records; stored sample IDs are never reused.

`config.systemKey` identifies system templates. Migration adopts the 12 known legacy system rows by legacy name and sort order, preserves their IDs, updates only those rows, and inserts missing records. It does not identify custom rows by category alone.

## Tasks

- [x] Author `templates/catalog/*.json`: 24 independent role samples, 6–8 modules each, internally consistent dates and responsibilities. Keep 12 legacy mappings and 12 additions from the approved directory.
- [x] Add `scripts/sync-template-catalog.mjs`: validate keys, content and layout; emit `docs/sql/migrate-template-content.sql` and replace the template seed region of `docs/sql/init.sql`; `--check` detects stale generated SQL. Include explicit transaction and advisory migration lock.
- [x] Add Java parser tests in `TemplateSampleContentTest.java` for valid samples, malformed/partial data rejection and safe legacy fallback. Run them before implementing the parser.
- [x] Add `TemplateSampleContent.java`, mapper read of `preview_config::text`, and `ResumeService` seeding from that content. Parse all sections before inserting, reject unknown types, copy objects, generate new UUIDs. Preserve legacy category fallback.
- [x] Apply supported template font, spacing and margin defaults to newly created resumes so full preview and creation match.
- [x] Add `frontend/src/utils/templateSample.ts`: normalize and validate preview content, synthesize renderable `ResumeDetail`, adapt template layout defaults consistently, handle missing custom samples explicitly.
- [x] Update `TemplatePreview.tsx` with actual text excerpts while retaining legacy fallback for custom templates. Add `TemplateSampleModal.tsx` using `ResumePreviewEngine` and responsive scaling. Update `Templates.tsx` with anonymous preview and explicit use actions, visible keyboard-accessible controls and sample notice.
- [x] Validate content/catalog, frontend production build and Java module tests. Verify migration twice against PostgreSQL with preservation checks and 24 sample profiles. Check representative single/two/sidebar layouts and multi-page export in a browser/PDF.
- [x] Review the full diff for spec compliance and code quality. Fix material findings, commit scoped files, preserving unrelated untracked documents.
- [ ] Inspect production Git/container state. Preserve server-local configuration and create a database backup. Build/deploy only affected services from the reviewed commit, apply migration transactionally, retain old image rollback tags.
- [ ] Verify public template count/content, representative preview pages, protected creation with a temporary verification account, and PDF. Remove only verification account/data. Report commit and deployment outcome.

## Commands and expected checks

- `node scripts/sync-template-catalog.mjs --check`: 24 valid profiles and generated SQL in sync.
- `mvn -B test -pl services/resume-service,services/template-service -am`: relevant Java tests pass.
- `npm run build` in `frontend`: type check and production bundle pass.
- `node export-service/scripts/contract-test.mjs`: renderer compatibility passes after changes affecting layout.
- Apply migration twice with `psql -v ON_ERROR_STOP=1`; compare template IDs, custom template data, and preexisting resume counts before/after.
- Production `/api/templates`: 24 versioned system samples plus existing custom templates; exact role matches for data analysis and teaching.

Execution uses separate content, frontend and backend responsibilities, followed by independent review and the authorized deployment. No further design approval is needed.
