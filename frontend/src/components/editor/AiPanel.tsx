import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, InputNumber, Modal, Progress, Select, Tag } from 'antd';
import { BulbOutlined, CopyOutlined, ExperimentOutlined, FileSearchOutlined, ReloadOutlined, RobotOutlined, ThunderboltFilled } from '@ant-design/icons';
import { aiApi } from '../../services/api';
import { message } from '../../utils/antdStatic';
import { collectBulletTargets, hasResumeContent, resolveTargetJob, resumeToPlainText, type AiBulletChange } from '../../utils/aiResume';
import { normalizeSectionData, type AiBatchResponse, type AiEngine, type AiHealth, type AiResultMeta,
  type AiTextResponse, type AtsScoreResponse, type InterviewQuestionsResponse, type JdParseResponse,
  type ResumeDetail, type SkillMatchResponse } from '../../types/resume';
import { SECTION_META } from '../../constants/sections';
import { aiErrorMessage, batchChanges, summaryInput } from './aiPanelState';
import { useAiRequest } from './useAiRequest';
import './AiPanel.css';

export { resumeToPlainText } from '../../utils/aiResume';

function EngineBadge({ engine }: { engine?: AiEngine }) {
  if (!engine) return null;
  return <Tag color={engine === 'llm' ? 'purple' : engine === 'rule' ? 'default' : 'warning'}>
    {engine === 'llm' ? '大模型' : engine === 'rule' ? '本地规则' : '暂不可用'}
  </Tag>;
}
function ResultMeta({ result }: { result: AiResultMeta & { engine?: AiEngine; suggestions?: string[] } }) {
  return <>
    <div className="ai-result-meta"><EngineBadge engine={result.engine} />
      {result.notice && <span>{result.notice}</span>}
      {!result.notice && result.fallbackReason && <span>模型暂不可用，以下为本地分析结果。</span>}
    </div>
    {!!result.suggestions?.length && <ul className="ai-advice">{result.suggestions.map((text, i) => <li key={i}>{text}</li>)}</ul>}
  </>;
}
function BlockTitle({ title, desc, icon }: { title: string; desc?: string; icon?: React.ReactNode }) {
  return <header className="ai-block-title"><h3>{icon}{title}</h3>{desc && <p>{desc}</p>}</header>;
}
function ErrorMessage({ error }: { error: string }) {
  return error ? <Alert role="alert" type="error" showIcon message={error} className="ai-alert" /> : null;
}
function ChangedNotice({ changed }: { changed: boolean }) {
  return changed ? <Alert type="warning" showIcon message="输入已变化，请重新分析以获取最新结果。" className="ai-alert" /> : null;
}
function CancelButton({ loading, cancel }: { loading: boolean; cancel: () => void }) {
  return loading ? <Button size="small" onClick={cancel}>取消生成</Button> : null;
}
async function copyText(value: string) {
  try {
    if (!navigator.clipboard) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(value); message.success('已复制');
  } catch { message.error('复制失败，请选中文本后复制'); }
}
function ensureText(result: AiTextResponse) {
  if (!result || typeof result.result !== 'string' || !result.result.trim()) throw new Error('没有生成可用正文，请重试');
  return result;
}
function summaryBefore(resume: ResumeDetail | null): string {
  const section = resume?.sections.find((item) => item.sectionType === 'summary');
  return section ? String(normalizeSectionData(section.data).content || '') : '';
}

interface SummaryProps { resume: ResumeDetail | null; role: string; onApply: (text: string, expectedBefore?: string) => Promise<void> }
function SummaryGenerator({ resume, role, onApply }: SummaryProps) {
  const [years, setYears] = useState<number | undefined>();
  const request = useAiRequest<AiTextResponse>();
  const [snapshot, setSnapshot] = useState({ input: '', before: '' });
  const [validation, setValidation] = useState('');
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState('');
  const applying = useRef(false);
  const content = resumeToPlainText(resume);
  const input = summaryInput(role, years, content);
  const run = () => {
    if (!hasResumeContent(resume)) { setValidation('请先填写简历中的经历、技能或个人总结。'); return; }
    if (input.length > 40000) { setValidation('简历内容过长，请缩短到 4 万字以内后生成。'); return; }
    setValidation(''); setApplyError(''); setApplied(false); setSnapshot({ input, before: summaryBefore(resume) });
    void request.run(async (signal) => ensureText(await aiApi.generateSummary(input, signal)));
  };
  const apply = async () => {
    if (!request.data || applying.current || applied || snapshot.input !== input) return;
    applying.current = true; setSaving(true); setApplyError('');
    try { await onApply(request.data.result, snapshot.before); setApplied(true); message.success('个人总结已保存'); }
    catch (error) { setApplyError(aiErrorMessage(error, '保存失败，请重试')); }
    finally { applying.current = false; setSaving(false); }
  };
  return <section className="ai-section">
    <BlockTitle title="生成 / 优化个人总结" icon={<BulbOutlined />} desc="依据现有经历提炼个人总结。先核对建议，再应用到简历。" />
    <label className="ai-field"><span>相关经验年限（选填）</span>
      <InputNumber aria-label="相关经验年限" value={years} onChange={(value) => setYears(value === null ? undefined : Number(value))}
        min={0} max={60} precision={0} placeholder="不填写则按现有内容" style={{ width: '100%' }} />
    </label>
    <ErrorMessage error={validation || request.error} />
    <div className="ai-actions"><Button type="primary" block loading={request.loading} disabled={saving} onClick={run} icon={<ThunderboltFilled />}>
      {request.loading ? '正在阅读简历…' : '生成个人总结'}</Button><CancelButton loading={request.loading} cancel={request.cancel} /></div>
    {request.data && <div className="ai-result" aria-live="polite">
      <ResultMeta result={request.data} /><ChangedNotice changed={!applied && snapshot.input !== input} />
      <div className="ai-comparison"><div><h4>现有个人总结</h4><p>{snapshot.before || '尚未填写'}</p></div><div><h4>建议稿</h4><p>{request.data.result}</p></div></div>
      <ErrorMessage error={applyError} />
      <div className="ai-actions"><Button type="primary" loading={saving} disabled={applied || snapshot.input !== input || request.data.engine === 'none'} onClick={() => void apply()}>
        {applied ? '已应用并保存' : '应用到简历'}</Button><Button icon={<CopyOutlined />} onClick={() => void copyText(request.data!.result)}>复制</Button></div>
      <p className="ai-hint">应用会替换个人总结。原文在生成后被编辑时，会要求重新生成，避免覆盖新内容。</p>
    </div>}
  </section>;
}

interface BatchResult { response: AiBatchResponse; changes: AiBulletChange[]; role: string }
function BatchOptimizer({ resume, role, onApply }: { resume: ResumeDetail | null; role: string; onApply: (changes: AiBulletChange[]) => Promise<void> }) {
  const targets = useMemo(() => collectBulletTargets(resume), [resume]);
  const sections = useMemo(() => (resume?.sections || []).filter((section) => targets.some((target) => target.sectionId === section.id)), [resume, targets]);
  const [sectionId, setSectionId] = useState(sections[0]?.id || '');
  const activeId = sections.some((section) => section.id === sectionId) ? sectionId : sections[0]?.id || '';
  const activeTargets = targets.filter((target) => target.sectionId === activeId);
  const [inputIds, setInputIds] = useState<string[]>(() => activeTargets.slice(0, 30).map((target) => target.id));
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const request = useAiRequest<BatchResult>();
  const [validation, setValidation] = useState('');
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState('');
  const applying = useRef(false);
  const stale = !!request.data && (request.data.role !== role || request.data.changes.some((change) => !targets.some((target) => target.id === change.id && target.before === change.before)));
  const selected = activeTargets.filter((target) => inputIds.includes(target.id));
  useEffect(() => {
    if (activeId && activeId !== sectionId) {
      setSectionId(activeId);
      setInputIds(targets.filter((target) => target.sectionId === activeId).slice(0, 30).map((target) => target.id));
      request.clear(); setCheckedIds([]); setApplied(false);
    }
  }, [activeId, sectionId, targets, request.clear]);
  const run = () => {
    if (!selected.length || selected.length > 30) { setValidation('请选择 1–30 条要点后优化。'); return; }
    if (selected.some((target) => target.before.length > 6000) || selected.reduce((sum, target) => sum + target.before.length, 0) > 60000) {
      setValidation('每条要点最多 6000 字，每次总计最多 6 万字，请减少所选内容。'); return;
    }
    setValidation(''); setApplyError(''); setApplied(false); setCheckedIds([]);
    void request.run(async (signal) => {
      const response = await aiApi.optimizeBullets(selected.map((target) => ({ id: target.id, content: target.before })), role, signal);
      return { response, changes: batchChanges(selected, response), role };
    }).then((result) => { if (result) setCheckedIds(result.changes.filter((change, index) => change.after !== change.before && result.response.items[index].engine !== 'none').map((change) => change.id)); });
  };
  const apply = async () => {
    const changes = request.data?.changes.filter((change) => checkedIds.includes(change.id)) || [];
    if (!changes.length || applying.current || applied || stale) return;
    applying.current = true; setSaving(true); setApplyError('');
    try { await onApply(changes); setApplied(true); message.success(`已保存 ${changes.length} 条要点`); }
    catch (error) { setApplyError(aiErrorMessage(error, '保存失败，请重试')); }
    finally { applying.current = false; setSaving(false); }
  };
  const changeSection = (value: string) => {
    request.clear(); setSectionId(value); setApplied(false); setValidation(''); setApplyError(''); setCheckedIds([]);
    setInputIds(targets.filter((target) => target.sectionId === value).slice(0, 30).map((target) => target.id));
  };
  return <section className="ai-section ai-batch">
    <BlockTitle title="批量优化经历要点" icon={<ThunderboltFilled />} desc="选择一个经历或项目模块，每次最多 30 条。核对后勾选需要应用的建议。" />
    {!sections.length ? <p className="ai-hint">先在工作、实习或项目模块填写要点，即可批量优化。</p> : <>
      <label className="ai-field"><span>选择模块</span><Select aria-label="选择要点模块" value={activeId} onChange={changeSection}
        disabled={request.loading || saving} options={sections.map((section) => ({ value: section.id,
          label: normalizeSectionData(section.data)._config?.moduleName || SECTION_META[section.sectionType]?.label || '经历模块' }))} /></label>
      <details className="ai-targets"><summary>选择待优化要点（{selected.length}/30）</summary>
        {activeTargets.map((target) => <Checkbox key={target.id} checked={inputIds.includes(target.id)}
          disabled={saving || request.loading || (!inputIds.includes(target.id) && selected.length >= 30)}
          onChange={(event) => setInputIds((ids) => event.target.checked ? [...ids, target.id] : ids.filter((id) => id !== target.id))}>
          <span className="ai-target-label">{target.label}</span>{target.before}</Checkbox>)}
      </details>
      <ErrorMessage error={validation || request.error} />
      <div className="ai-actions"><Button block loading={request.loading} disabled={saving || !selected.length} onClick={run}>
        {request.loading ? '正在逐条优化…' : `优化所选 ${selected.length} 条要点`}</Button><CancelButton loading={request.loading} cancel={request.cancel} /></div>
      {request.data && <div className="ai-result" aria-live="polite"><ResultMeta result={request.data.response} /><ChangedNotice changed={stale && !applied} />
        {request.data.changes.map((change, index) => {
          const item = request.data!.response.items[index]; const unchanged = change.before === change.after;
          return <article className="ai-batch-item" key={change.id}>
            <Checkbox checked={checkedIds.includes(change.id)} disabled={saving || applied || stale || unchanged || item.engine === 'none'}
              onChange={(event) => setCheckedIds((ids) => event.target.checked ? [...ids, change.id] : ids.filter((id) => id !== change.id))}>
              {change.label}{unchanged ? '（原文保留）' : ''}</Checkbox>
            <div className="ai-comparison"><div><h4>原文</h4><p>{change.before}</p></div><div><h4>建议</h4><p>{change.after}</p></div></div>
            {!!item.suggestions?.length && <ul className="ai-advice">{item.suggestions.map((advice, i) => <li key={i}>{advice}</li>)}</ul>}
          </article>;
        })}<ErrorMessage error={applyError} />
        <Button type="primary" block loading={saving} disabled={applied || stale || !checkedIds.length} onClick={() => void apply()}>
          {applied ? '已应用并保存' : `应用所选 ${checkedIds.length} 条建议`}</Button>
      </div>}
    </>}
  </section>;
}

function JdField({ jd, setJd }: { jd: string; setJd: (value: string) => void }) {
  return <label className="ai-field"><span>目标岗位 JD</span><Input.TextArea aria-label="目标岗位 JD" value={jd} onChange={(event) => setJd(event.target.value)}
    placeholder="粘贴职位描述、任职要求…" autoSize={{ minRows: 5, maxRows: 12 }} maxLength={20000} showCount /></label>;
}
function KeywordTags({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  return items.length ? <div className="ai-keywords"><h4>{title}</h4><div>{items.map((item, index) => <Tag color={tone} key={`${item}-${index}`}>{item}</Tag>)}</div></div> : null;
}
function AtsChecker({ resume, jd, setJd }: { resume: ResumeDetail | null; jd: string; setJd: (value: string) => void }) {
  const request = useAiRequest<AtsScoreResponse>(); const [validation, setValidation] = useState(''); const [snapshot, setSnapshot] = useState('');
  const content = resumeToPlainText(resume); const input = `${jd}\n${content}`;
  const run = () => {
    if (jd.trim().length < 20) { setValidation('请粘贴至少 20 字的岗位 JD。'); return; }
    if (!hasResumeContent(resume)) { setValidation('请先填写简历内容，再进行 ATS 体检。'); return; }
    setValidation(''); setSnapshot(input);
    void request.run(async (signal) => {
      const result = await aiApi.atsScore(jd.trim(), content, signal);
      if (!result?.scores || !Array.isArray(result.suggestions)) throw new Error('评分结果不完整，请重试');
      return result;
    });
  };
  const result = request.data;
  return <section className="ai-section"><BlockTitle title="ATS 简历体检" icon={<ExperimentOutlined />} desc="对照岗位要求分析关键词、技能和经历。分数用于匹配参考。" />
    <JdField jd={jd} setJd={setJd} /><ErrorMessage error={validation || request.error} />
    <div className="ai-actions"><Button type="primary" block loading={request.loading} onClick={run}>开始体检</Button><CancelButton loading={request.loading} cancel={request.cancel} /></div>
    {result && <div className="ai-result" aria-live="polite"><ChangedNotice changed={snapshot !== input} />
      <div className="ai-scores"><Progress type="circle" percent={result.scores.overall} size={84} format={(value) => <span>{value}<small>综合分</small></span>} />
        <div>{([['keywords', '关键词覆盖'], ['skills', '技能匹配'], ['experience', '经历描述'], ['education', '教育背景']] as const).map(([key, label]) =>
          <div key={key} className="ai-score-bar"><span>{label}</span><Progress percent={result.scores[key]} size="small" /></div>)}</div></div>
      <ResultMeta result={result} />{!result.suggestions.length && <p className="ai-hint">暂未发现明显短板，仍建议结合实际岗位核对。</p>}
      <KeywordTags title="简历缺少的关键词" items={result.missingSkills || []} tone="orange" /><KeywordTags title="已命中关键词" items={result.matchedSkills || []} tone="green" />
    </div>}
  </section>;
}
function TextList({ title, items }: { title: string; items: string[] }) {
  return items.length ? <div className="ai-list"><h4>{title}</h4><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null;
}
function JdAnalyzer({ resume, jd, setJd }: { resume: ResumeDetail | null; jd: string; setJd: (value: string) => void }) {
  const parseRequest = useAiRequest<JdParseResponse>(); const matchRequest = useAiRequest<SkillMatchResponse>();
  const [validation, setValidation] = useState(''); const [parseSnapshot, setParseSnapshot] = useState(''); const [matchSnapshot, setMatchSnapshot] = useState('');
  const content = resumeToPlainText(resume); const input = `${jd}\n${content}`;
  const validJd = () => {
    if (jd.trim().length < 10) { setValidation('请粘贴至少 10 字的岗位 JD。'); return false; }
    setValidation(''); return true;
  };
  const parse = async () => {
    if (!validJd()) return; setParseSnapshot(jd);
    await parseRequest.run(async (signal) => {
      const result = await aiApi.parseJd(jd.trim(), signal);
      if (!Array.isArray(result?.skills) || !Array.isArray(result?.requirements) || !Array.isArray(result?.responsibilities)) throw new Error('岗位画像不完整，请重试');
      return result;
    });
  };
  const match = async () => {
    if (!validJd()) return;
    if (!hasResumeContent(resume)) { setValidation('请先填写简历内容，再匹配技能。'); return; }
    setMatchSnapshot(input);
    await matchRequest.run(async (signal) => {
      const result = await aiApi.matchSkills(content, jd.trim(), signal);
      if (!Array.isArray(result?.matched) || !Array.isArray(result?.missing)) throw new Error('技能匹配结果不完整，请重试');
      return result;
    });
  };
  const loading = parseRequest.loading || matchRequest.loading; const parsed = parseRequest.data; const matched = matchRequest.data;
  return <section className="ai-section"><BlockTitle title="JD 解析与技能匹配" icon={<FileSearchOutlined />} desc="岗位画像与技能匹配分别分析，成功结果会独立保留。" />
    <JdField jd={jd} setJd={setJd} /><ErrorMessage error={validation} />
    <div className="ai-actions"><Button block loading={loading} onClick={() => void Promise.allSettled([parse(), match()])}>解析并匹配</Button>
      <CancelButton loading={loading} cancel={() => { parseRequest.cancel(); matchRequest.cancel(); }} /></div>
    <div className="ai-analysis-part"><h3>技能匹配{matchRequest.loading && ' · 分析中…'}</h3><ErrorMessage error={matchRequest.error} />
      {matchRequest.error && <Button size="small" onClick={() => void match()}>重试技能匹配</Button>}
      {matched && <><ChangedNotice changed={matchSnapshot !== input} /><div className="ai-match-rate"><strong>{Math.round(matched.matchRate)}%</strong><span>技能匹配度<br />命中 {matched.matched.length} 项 · 缺少 {matched.missing.length} 项</span></div>
        <ResultMeta result={matched} /><KeywordTags title="待核对的技能" items={matched.missing} tone="orange" /><KeywordTags title="已匹配技能" items={matched.matched} tone="green" />
        <p className="ai-hint">仅补充你实际掌握的技能；可以把缺少的技能用作学习清单。</p></>}
    </div>
    <div className="ai-analysis-part"><h3>岗位画像{parseRequest.loading && ' · 解析中…'}</h3><ErrorMessage error={parseRequest.error} />
      {parseRequest.error && <Button size="small" onClick={() => void parse()}>重试岗位解析</Button>}
      {parsed && <><ChangedNotice changed={parseSnapshot !== jd} /><ResultMeta result={parsed} /><div className="ai-job-facts">{parsed.years && <span>经验：{parsed.years}</span>}{parsed.education && <span>学历：{parsed.education}</span>}</div>
        <KeywordTags title="核心技能" items={parsed.skills} /><TextList title="主要职责" items={parsed.responsibilities} /><TextList title="任职要求" items={parsed.requirements} /></>}
    </div>
  </section>;
}
function InterviewPanel({ resume, role }: { resume: ResumeDetail | null; role: string }) {
  const request = useAiRequest<InterviewQuestionsResponse>(); const [validation, setValidation] = useState(''); const [snapshot, setSnapshot] = useState('');
  const content = resumeToPlainText(resume); const input = `${role}\n${content}`;
  const run = () => {
    if (!hasResumeContent(resume)) { setValidation('请先填写经历、技能或项目，再生成面试题。'); return; }
    setValidation(''); setSnapshot(input);
    void request.run(async (signal) => {
      const result = await aiApi.interviewQuestions(role.trim(), content, signal);
      if (!Array.isArray(result?.questions)) throw new Error('面试题结果不完整，请重试'); return result;
    });
  };
  return <section className="ai-section"><BlockTitle title="模拟面试题" icon={<RobotOutlined />} desc={`结合${role ? `「${role}」岗位和` : ''}简历中的真实经历，预测可能被追问的问题。`} />
    <ErrorMessage error={validation || request.error} /><div className="ai-actions"><Button type="primary" block loading={request.loading} onClick={run}>{request.data ? '重新生成面试题' : '生成面试题'}</Button><CancelButton loading={request.loading} cancel={request.cancel} /></div>
    {request.data && <div className="ai-result" aria-live="polite"><ChangedNotice changed={snapshot !== input} /><ResultMeta result={request.data} />
      {request.data.questions.length ? <><h4>共 {request.data.questions.length} 题</h4><ol className="ai-interview">{request.data.questions.map((question, index) => <li key={index}>{question}</li>)}</ol>
        <Button icon={<CopyOutlined />} onClick={() => void copyText(request.data!.questions.map((question, index) => `${index + 1}. ${question}`).join('\n\n'))}>复制全部面试题</Button></> : <p className="ai-hint">没有生成题目，请完善简历后重试。</p>}
    </div>}
  </section>;
}

type AiTab = 'optimize' | 'ats' | 'jd' | 'interview';
interface Props {
  resume: ResumeDetail | null;
  onApplySummary: (text: string, expectedBefore?: string) => Promise<void>;
  onApplyBullets: (changes: AiBulletChange[]) => Promise<void>;
}
export default function AiPanel({ resume, onApplySummary, onApplyBullets }: Props) {
  const [tab, setTab] = useState<AiTab>('optimize'); const [jd, setJd] = useState(''); const [roleOverride, setRoleOverride] = useState<string | null>(null);
  const role = roleOverride ?? resolveTargetJob(resume); const health = useAiRequest<AiHealth>();
  const checkHealth = useCallback(() => { void health.run((signal) => aiApi.health(signal)); }, [health.run]);
  useEffect(checkHealth, [checkHealth]);
  const status = health.data?.modelStatus || (health.data?.llmEnabled ? 'configured' : 'unconfigured');
  const healthText = health.loading || (!health.data && !health.error) ? '正在检测 AI 服务…' : health.error ? 'AI 服务暂时离线，请重试'
    : status === 'available' ? '大模型近期调用成功' : status === 'configured' ? '大模型已配置，等待调用验证'
      : status === 'unavailable' ? '大模型暂不可用，使用本地分析' : '本地分析可用';
  const tabs: { key: AiTab; label: string; icon: React.ReactNode }[] = [
    { key: 'optimize', label: '内容', icon: <BulbOutlined /> }, { key: 'ats', label: 'ATS', icon: <ExperimentOutlined /> },
    { key: 'jd', label: '岗位', icon: <FileSearchOutlined /> }, { key: 'interview', label: '面试', icon: <RobotOutlined /> },
  ];
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return; event.preventDefault(); setTab(tabs[next].key); document.getElementById(`ai-tab-${tabs[next].key}`)?.focus();
  };
  return <div className="ai-panel">
    <div className="ai-health" role="status"><span className={`ai-health-dot ${health.error ? 'offline' : status}`} /><span>{healthText}</span>
      <Button size="small" type="text" aria-label="重新检测 AI 服务" icon={<ReloadOutlined spin={health.loading} />} disabled={health.loading} onClick={checkHealth} /></div>
    <div className="ai-shared-role"><label className="ai-field"><span>目标岗位（四页签共用）</span><Input aria-label="AI 目标岗位" value={role} placeholder="填写目标岗位，提高建议相关性" maxLength={200} onChange={(event) => setRoleOverride(event.target.value)} /></label></div>
    <div className="ai-tabs" role="tablist" aria-label="AI 助手功能">{tabs.map((item, index) => <button type="button" role="tab" key={item.key}
      id={`ai-tab-${item.key}`} aria-controls={`ai-panel-${item.key}`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1}
      onKeyDown={(event) => onTabKey(event, index)} onClick={() => setTab(item.key)}>{item.icon}{item.label}</button>)}</div>
    <div className="ai-panel-body thin-scroll">{!resume ? <Empty description="简历加载中…" /> : <>
      <div id="ai-panel-optimize" role="tabpanel" aria-labelledby="ai-tab-optimize" hidden={tab !== 'optimize'}><SummaryGenerator resume={resume} role={role} onApply={onApplySummary} /><BatchOptimizer resume={resume} role={role} onApply={onApplyBullets} /></div>
      <div id="ai-panel-ats" role="tabpanel" aria-labelledby="ai-tab-ats" hidden={tab !== 'ats'}><AtsChecker resume={resume} jd={jd} setJd={setJd} /></div>
      <div id="ai-panel-jd" role="tabpanel" aria-labelledby="ai-tab-jd" hidden={tab !== 'jd'}><JdAnalyzer resume={resume} jd={jd} setJd={setJd} /></div>
      <div id="ai-panel-interview" role="tabpanel" aria-labelledby="ai-tab-interview" hidden={tab !== 'interview'}><InterviewPanel resume={resume} role={role} /></div>
    </>}</div>
  </div>;
}

export function AiOptimizeModal({ open, source, jobTitle, onClose, onApply }: {
  open: boolean; source: string; jobTitle?: string; onClose: () => void; onApply: (text: string) => void | Promise<void>;
}) {
  const { data: response, loading, error, run: requestRun, clear, cancel } = useAiRequest<AiTextResponse & { sourceSnapshot: string; jobSnapshot?: string }>();
  const data = response?.sourceSnapshot === source && response?.jobSnapshot === jobTitle ? response : null;
  const [saving, setSaving] = useState(false); const [applyError, setApplyError] = useState(''); const applying = useRef(false);
  const run = useCallback(() => {
    setApplyError(''); if (!source.trim()) { clear(); return; }
    void requestRun(async (signal) => ({ ...ensureText(await aiApi.optimizeBullet(source, jobTitle, signal)), sourceSnapshot: source, jobSnapshot: jobTitle }));
  }, [source, jobTitle, requestRun, clear]);
  useEffect(() => { if (open) run(); else { clear(); setApplyError(''); } return cancel; }, [open, run, clear, cancel]);
  const close = () => { if (saving) return; clear(); onClose(); };
  const apply = async () => {
    if (!data || applying.current || loading) return; applying.current = true; setSaving(true); setApplyError('');
    try { await onApply(data.result); clear(); onClose(); message.success('优化结果已保存'); }
    catch (failure) { setApplyError(aiErrorMessage(failure, '保存失败，请重试')); }
    finally { applying.current = false; setSaving(false); }
  };
  return <Modal open={open} onCancel={close} title="AI 优化这段描述" width={720} closable={!saving} maskClosable={!saving}
    footer={<div className="ai-modal-actions"><Button disabled={saving} onClick={close}>取消</Button><Button icon={<ReloadOutlined />} onClick={run} disabled={loading || saving}>换个说法</Button>
      <Button type="primary" loading={saving} disabled={!data || loading || data.engine === 'none'} onClick={() => void apply()}>应用优化结果</Button></div>}>
    <div className="ai-modal-content"><ErrorMessage error={error || applyError} />{data && <ResultMeta result={data} />}
      <div className="ai-comparison ai-modal-comparison"><div><h4>原文</h4><p>{source}</p></div><div><h4>优化后</h4><p aria-live="polite">{loading ? '正在优化…' : data?.result || '暂无建议'}</p></div></div>
      <p className="ai-hint">核对职责、技能和数字是否准确，再应用建议。保存失败时可直接重试。</p>
    </div>
  </Modal>;
}
