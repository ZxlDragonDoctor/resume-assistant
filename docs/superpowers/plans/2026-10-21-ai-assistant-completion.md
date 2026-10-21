# AI Assistant Completion Implementation Plan

> **For agentic workers:** Use the systematic-debugging, test-driven-development and dispatching-parallel-agents skills. Steps use checkbox syntax for tracking.

**Goal:** Complete and test the existing AI assistant from generated suggestions to persisted resume edits.

**Architecture:** Keep existing FastAPI synchronous AI endpoints, Java resume ownership/persistence APIs and React editor. Add strict AI contracts, bounded model calls, role-aware factual fallback and pure frontend data helpers. Use per-resume mounted panels and async save callbacks.

**Tech Stack:** Python 3.12/3.13, FastAPI, Pydantic 2, LangChain 0.3, React 18, Ant Design 5, TypeScript, pytest, node:test/esbuild, browser tests.

## Task 1: Request and model contracts

Files: `ai-service/app/api/routes.py`, `app/main.py`, `app/core/config.py`, `app/services/ai_service.py`, `app/schemas.py`, `tests/test_ai_api.py`, `tests/test_ai_service.py`.

- [x] Add failing tests for blank/oversized input, wrong types, invalid arrays, malformed model JSON, bool/out-of-range scores, incomplete JD and timeout.
- [x] Add bounded input/output Pydantic models and envelope error handlers. Implement ID-based batch request/response from the design and preserve order.
- [x] Bound full model execution, separate advice from body text, track modelStatus and sanitize errors. Honor translation language. Run pytest with a fake provider and zero real credentials.

Example contract assertion:
```python
response = client.post('/api/ai/optimize-bullets', json={'job_title':'测试工程师','bullets':[{'id':'a','content':'参与接口测试'}]})
assert response.json()['data']['items'][0]['id'] == 'a'
assert response.json()['data']['items'][0]['before'] == '参与接口测试'
```

## Task 2: Factual local analysis

Files: `ai-service/app/services/rule_engine.py`, `ai-service/tests/test_rule_engine.py`.

- [x] Add failing regressions for `JavaScript` not matching `Java`, `Django` not matching `Go`, dates not becoming experience, minimum versus preferred education, and no fabricated leadership/numbers/technical profession.
- [x] Expand role vocabulary, canonicalize aliases and match term boundaries; fix experience ranges/upper bounds, quantified evidence and JD-related scoring.
- [x] Generate clean applicable text; return advice separately through the service. Test all catalog role samples plus existing script.

Example assertions:
```python
assert 'Java' not in rules.extract_skills('JavaScript')
assert rules.extract_years('2024年毕业，应届生') != '2024年以上'
assert '主导' not in rules.optimize_bullet_local('运营','参与社群活动')
```

## Task 3: Editor data and persistence

Files: `frontend/src/utils/aiResume.ts`, corresponding `.test.mjs`, `frontend/src/stores/resumeStore.ts`, `frontend/src/services/api.ts`, `frontend/src/pages/Editor.tsx`.

- [x] Add failing tests for content extraction, role priority, hidden/empty sections, legacy skills, stable target paths and changed original text.
- [x] Implement immutable one-module change planning. Reject stale, missing or mismatched targets before writing.
- [x] Merge the returned new section into current state instead of reloading server data. Preserve unrelated drafts and reject cross-resume responses.
- [x] Make AI callbacks asynchronous, preserve style configuration, wait for persistence before success, and retain errors for retry. Test failed saves and new summary behavior.

Example assertions:
```js
assert.throws(() => planBulletChanges(changedResume, proposals), /已修改/);
assert.equal(planBulletChanges(resume, proposals)[0].data._config.moduleName, '项目经历');
```

## Task 4: Assistant UI

Files: `frontend/src/components/editor/AiPanel.tsx`, focused helper components if needed, `frontend/src/types/resume.ts`, `frontend/src/services/api.ts` AI block.

- [x] Add summary comparison, module selection, batch request and selectable per-item suggestions. Use IDs plus before values for application.
- [x] Remove hardcoded role/year facts. Keep per-resume panel state, shared JD, loading/error/retry/cancel states and actual engine labels.
- [x] Isolate asynchronous requests by sequence/AbortController. Reuse one guarded request path for initial optimization and retry.
- [x] Show JD and matching partial results independently; reject stale applications and await successful save before marking applied.

## Task 5: Integration, deployment and evidence

- [x] Run `python -m pytest ai-service/tests`, the existing rule script, `node --test` AI helper/store checks and `npm run build`.
- [x] Use browser tests with synthetic data to cover four tabs, single/batch application, failures, state retention and reload persistence.
- [ ] Exercise the configured production model with a small synthetic sample for each capability. Record engines and results without credentials.
- [ ] Review the complete diff, commit scoped files and push. Build runtime images from existing server dependencies, preserve environment and rollback images, deploy AI/frontend, then repeat public smoke checks.
- [ ] Remove synthetic accounts/resumes and record real test totals and limitations in the release note.

## Local verification results (2026-10-22)

- Python AI API/service and rule suite: **130 passed, 53 subtests passed**.
- Existing local-rule smoke script: **6 capabilities passed** with no configured model.
- Frontend helper, store, panel and API contract suite: **18 passed**.
- Real Chromium/Puppeteer flow against the local synthetic API and actual FastAPI routes: **20 browser checks passed**. Covers the four tabs, summary persistence after reload, single/batch save retry, batch selection, independent JD failures and narrow desktop layout.
- `npm run build`: TypeScript check and Vite production bundle succeeded. Vite reports the existing >500 kB chunk advisory.
- Local browser and backend used synthetic resume data; the API-key setting was forced empty for that run.
