/**
 * AI 助手面板
 * ------------------------------------------------------------------
 * 把 ai-service 的六项能力收进编辑器右栏的第二个页签：
 *   1. 内容优化   —— 逐条打磨要点描述（optimize-bullet / generate-summary）
 *   2. ATS 体检   —— 对照 JD 打分并给出改进建议（ats-score）
 *   3. JD 解析    —— 拆出关键词、年限、职责（parse-jd）
 *   4. 技能匹配   —— 简历 vs JD 的命中 / 缺失（match-skills）
 *   5. 面试预测   —— 基于简历生成面试题（interview-questions）
 *
 * 关键设计：结果一律以「建议卡片」呈现，用户点击「应用」才写回简历，
 * 不做静默改写 —— 简历是强个人表达，AI 只能建议，不能代笔。
 *
 * 降级：ai-service 在未配置大模型时走本地规则引擎，
 * 每个响应都带 engine 字段，界面据此提示"本地规则"模式。
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, InputNumber, Modal, Space, Spin, Tag, Tooltip } from 'antd';
import {
  BulbOutlined,
  CheckCircleFilled,
  CopyOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RiseOutlined,
  RobotOutlined,
  ThunderboltFilled,
  WarningFilled,
} from '@ant-design/icons';

import { aiApi } from '../../services/api';
import { message } from '../../utils/antdStatic';
import SectionIcon from '../common/SectionIcon';
import { SECTION_META } from '../../constants/sections';
import {
  normalizeSectionData,
  type AiEngine,
  type AtsScoreResponse,
  type JdParseResponse,
  type ResumeDetail,
  type SkillMatchResponse,
} from '../../types/resume';
import { brand, neutral, radius, semantic, shadow, text, transition } from '../../styles/tokens';
import { plainText } from '../../utils/thumbnail';

// ==================================================================
// 通用：把整份简历压成纯文本，作为 AI 的输入
// ==================================================================

export function resumeToPlainText(resume: ResumeDetail | null): string {
  if (!resume) return '';
  const lines: string[] = [];

  const sections = [...(resume.sections || [])]
    .filter((s) => s.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  sections.forEach((section) => {
    const data = normalizeSectionData(section.data);
    const label =
      (data._config as { moduleName?: string } | undefined)?.moduleName ||
      SECTION_META[section.sectionType]?.label ||
      section.sectionType;
    lines.push(`## ${label}`);

    if (section.sectionType === 'basic') {
      const parts = [
        data.name,
        data.jobTitle,
        data.phone,
        data.email,
        data.city,
        data.website,
      ]
        .map((v) => plainText(v))
        .filter(Boolean);
      lines.push(parts.join(' | '));
      return;
    }

    if (data.content) {
      lines.push(plainText(data.content));
    }

    const items = Array.isArray(data.items) ? data.items : [];
    items.forEach((raw) => {
      if (typeof raw === 'string') {
        lines.push(`- ${raw}`);
        return;
      }
      const item = raw as Record<string, unknown>;
      const head = [
        item.company,
        item.school,
        item.name,
        item.title,
        item.position,
        item.role,
        item.degree,
        item.major,
        item.level,
        item.tech,
      ]
        .map((v) => plainText(v))
        .filter(Boolean)
        .join(' · ');
      const date = [item.startDate, item.endDate].filter(Boolean).join(' - ');
      if (head || date) lines.push(`- ${head}${date ? ` (${date})` : ''}`);
      const groupItems = Array.isArray(item.items) ? item.items : [];
      groupItems.forEach((g) => lines.push(`  - ${plainText(g)}`));
      const bullets = Array.isArray(item.bullets) ? item.bullets : [];
      bullets.forEach((b) => {
        const text = plainText(b);
        if (text) lines.push(`  - ${text}`);
      });
      if (item.description) lines.push(`  ${plainText(item.description)}`);
    });

    const links = Array.isArray(data.links) ? data.links : [];
    links.forEach((l) => {
      const link = l as { label?: string; url?: string };
      if (link.label || link.url) lines.push(`- ${link.label || ''} ${link.url || ''}`);
    });
  });

  return lines.join('\n');
}

// ==================================================================
// 小部件
// ==================================================================

/** 引擎标识 */
function EngineBadge({ engine }: { engine?: AiEngine }) {
  if (!engine) return null;
  if (engine === 'llm') {
    return (
      <Tooltip title="由大模型生成" mouseEnterDelay={0.3}>
        <Tag
          color="purple"
          style={{ fontSize: 10.5, lineHeight: '16px', margin: 0, borderRadius: radius.xs }}
        >
          <ThunderboltFilled style={{ fontSize: 9, marginRight: 3 }} />
          大模型
        </Tag>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="未配置大模型密钥，当前由本地规则引擎给出建议" mouseEnterDelay={0.3}>
      <Tag
        style={{
          fontSize: 10.5,
          lineHeight: '16px',
          margin: 0,
          borderRadius: radius.xs,
          background: neutral[100],
          border: `1px solid ${neutral[200]}`,
          color: neutral[500],
        }}
      >
        本地规则
      </Tag>
    </Tooltip>
  );
}

/** 区块标题 */
function BlockTitle({
  icon,
  title,
  desc,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: brand.primary, fontSize: 14, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: neutral[800], flex: 1 }}>{title}</span>
        {extra}
      </div>
      {desc && (
        <div style={{ fontSize: 11.5, color: neutral[400], lineHeight: 1.7, marginTop: 5 }}>
          {desc}
        </div>
      )}
    </div>
  );
}

/** 建议卡片 */
function SuggestionCard({
  text,
  onApply,
  applied,
}: {
  text: string;
  onApply?: () => void;
  applied?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${neutral[150]}`,
        borderRadius: radius.lg,
        padding: '10px 12px',
        marginBottom: 9,
        background: '#fff',
        transition: transition.fast,
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.8,
          color: neutral[700],
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 9,
          paddingTop: 8,
          borderTop: `1px dashed ${neutral[150]}`,
        }}
      >
        {onApply && (
          <button
            onClick={onApply}
            disabled={applied}
            style={{
              border: 'none',
              background: applied ? semantic.successSoft : brand.primarySoft,
              color: applied ? semantic.success : brand.primary,
              borderRadius: radius.sm,
              padding: '4px 11px',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: applied ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {applied ? <CheckCircleFilled style={{ fontSize: 11 }} /> : null}
            {applied ? '已应用' : '应用到简历'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <Tooltip title="复制这段文本" mouseEnterDelay={0.4}>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(text);
              message.success('已复制');
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: neutral[400],
              cursor: 'pointer',
              fontSize: 11.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 6px',
            }}
          >
            <CopyOutlined style={{ fontSize: 11 }} /> 复制
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/** 环形分数 */
function ScoreRing({ value, size = 78 }: { value: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color = value >= 80 ? semantic.success : value >= 60 ? brand.primary : semantic.warning;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={neutral[150]}
          strokeWidth={stroke}
        />
        <circle
          className="score-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 21,
            fontWeight: 700,
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(value)}
        </span>
        <span style={{ fontSize: 9.5, color: neutral[400], marginTop: 2 }}>综合分</span>
      </div>
    </div>
  );
}

/** 细分项进度条 */
function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? semantic.success : value >= 60 ? brand.primary : semantic.warning;
  return (
    <div style={{ marginBottom: 7 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: neutral[500],
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: neutral[150], overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: '100%',
            background: color,
            borderRadius: 99,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}

/** 空状态（面板内） */
function PanelEmpty({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '34px 16px',
        textAlign: 'center',
        fontSize: 12.5,
        color: neutral[400],
        lineHeight: 1.8,
      }}
    >
      {text}
    </div>
  );
}

// ==================================================================
// 1. 内容优化
// ==================================================================

const SUMMARY_PROMPT_ROLES = [
  'Java 后端开发',
  '前端开发',
  '全栈开发',
  '算法 / 数据',
  '产品 / 运营',
];

function ContentOptimizer({
  resume,
  onGenerateSummary,
  onOptimizeBullets,
}: {
  resume: ResumeDetail | null;
  onGenerateSummary: (text: string) => void;
  onOptimizeBullets: (pairs: { before: string; after: string }[]) => void;
}) {
  const [role, setRole] = useState(resume?.targetJob || 'Java 后端开发');
  const [years, setYears] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [engine, setEngine] = useState<AiEngine | undefined>();

  const run = async () => {
    const info = `${role}，${years} 年相关经验。以下是现有简历内容：\n\n${resumeToPlainText(resume)}`;
    setLoading(true);
    try {
      const res = await aiApi.generateSummary(info);
      setSummary(res.result);
      setEngine(res.engine);
    } catch {
      /* 错误提示已由 http 拦截器统一处理 */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <BlockTitle
        icon={<BulbOutlined />}
        title="生成 / 优化个人总结"
        desc="AI 会通读你的整份简历，提炼出一段与目标岗位匹配的自我评价。"
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="目标岗位"
          size="small"
          style={{ flex: 1 }}
        />
        <Space.Compact style={{ width: 92 }}>
          <InputNumber
            value={years}
            onChange={(v) => setYears(Number(v) || 0)}
            min={0}
            max={40}
            size="small"
            style={{ width: '100%' }}
          />
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: 12,
              color: text.tertiary,
              background: neutral[50],
              border: `1px solid ${neutral[200]}`,
              borderLeft: 'none',
              borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
              whiteSpace: 'nowrap',
            }}
          >
            年
          </span>
        </Space.Compact>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {SUMMARY_PROMPT_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            style={{
              border: `1px solid ${role === r ? brand.primaryBorder : neutral[200]}`,
              background: role === r ? brand.primarySoft : '#fff',
              color: role === r ? brand.primaryActive : neutral[500],
              borderRadius: radius.pill,
              padding: '3px 10px',
              fontSize: 11.5,
              cursor: 'pointer',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <Button
        type="primary"
        block
        loading={loading}
        onClick={run}
        icon={loading ? undefined : <ThunderboltFilled />}
        style={{
          background: loading ? undefined : brand.gradient,
          border: 'none',
          height: 34,
          fontSize: 12.5,
        }}
      >
        {loading ? '正在阅读你的简历…' : '生成个人总结'}
      </Button>

      {summary && (
        <div style={{ marginTop: 14 }}>
          <BlockTitle
            icon={<FileSearchOutlined />}
            title="建议稿"
            extra={<EngineBadge engine={engine} />}
          />
          <SuggestionCard text={summary} onApply={() => onGenerateSummary(summary)} />
          <div style={{ fontSize: 11, color: neutral[400], lineHeight: 1.7 }}>
            提示：应用后会覆盖「个人总结」模块的现有内容，可随时用 Ctrl+Z 之外的
            「版本」功能回退。
          </div>
        </div>
      )}
    </div>
  );
}

// ==================================================================
// 2. ATS 体检
// ==================================================================

function AtsChecker({ resume }: { resume: ResumeDetail | null }) {
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AtsScoreResponse | null>(null);

  const run = async () => {
    if (jd.trim().length < 20) {
      message.warning('请先粘贴岗位 JD（至少 20 个字），体检结果才有参考价值');
      return;
    }
    setLoading(true);
    try {
      const res = await aiApi.atsScore(jd, resumeToPlainText(resume));
      setResult(res);
    } catch {
      /* handled */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <BlockTitle
        icon={<ExperimentOutlined />}
        title="ATS 简历体检"
        desc="把目标岗位的 JD 粘进来，对照简历给出关键词覆盖度、技能匹配度等维度的评分。"
      />

      <Input.TextArea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="粘贴岗位 JD…（职位描述、任职要求）"
        autoSize={{ minRows: 5, maxRows: 11 }}
        style={{ fontSize: 12.5, lineHeight: 1.75 }}
      />

      <Button
        type="primary"
        block
        loading={loading}
        onClick={run}
        icon={loading ? undefined : <RiseOutlined />}
        style={{
          marginTop: 10,
          background: loading ? undefined : brand.gradient,
          border: 'none',
          height: 34,
          fontSize: 12.5,
        }}
      >
        {loading ? '正在比对…' : '开始体检'}
      </Button>

      {loading && (
        <div style={{ textAlign: 'center', padding: '26px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 22, color: brand.primary }} spin />} />
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: 16 }} className="animate-fade">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 14,
              border: `1px solid ${neutral[150]}`,
              borderRadius: radius.lg,
              background: neutral[25],
              marginBottom: 14,
            }}
          >
            <ScoreRing value={result.scores.overall} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <ScoreBar label="关键词覆盖" value={result.scores.keywords} />
              <ScoreBar label="技能匹配" value={result.scores.skills} />
              <ScoreBar label="经历描述" value={result.scores.experience} />
              <ScoreBar label="教育背景" value={result.scores.education} />
            </div>
          </div>

          <BlockTitle
            icon={<BulbOutlined />}
            title="改进建议"
            extra={<EngineBadge engine={result.engine} />}
          />

          {result.suggestions.length === 0 ? (
            <PanelEmpty text="这份简历与岗位匹配良好，暂无明显短板。" />
          ) : (
            result.suggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '9px 11px',
                  background: '#fff',
                  border: `1px solid ${neutral[150]}`,
                  borderRadius: radius.md,
                  marginBottom: 7,
                  fontSize: 12.5,
                  lineHeight: 1.75,
                  color: neutral[700],
                }}
              >
                <WarningFilled style={{ color: semantic.warning, fontSize: 12, marginTop: 4 }} />
                <span style={{ flex: 1 }}>{s}</span>
              </div>
            ))
          )}

          {!!result.missingSkills?.length && (
            <div style={{ marginTop: 14 }}>
              <BlockTitle icon={<FileSearchOutlined />} title="JD 中提到但简历缺失" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.missingSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 9px',
                      borderRadius: radius.pill,
                      background: semantic.dangerSoft,
                      color: semantic.danger,
                      fontSize: 11.5,
                      border: `1px solid ${semantic.danger}22`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!result.matchedSkills?.length && (
            <div style={{ marginTop: 14 }}>
              <BlockTitle icon={<CheckCircleFilled />} title="已命中关键词" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.matchedSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 9px',
                      borderRadius: radius.pill,
                      background: semantic.successSoft,
                      color: semantic.success,
                      fontSize: 11.5,
                      border: `1px solid ${semantic.success}22`,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && <PanelEmpty text="粘贴一段 JD 后点击「开始体检」。" />}
    </div>
  );
}

// ==================================================================
// 3. JD 解析 + 技能匹配
// ==================================================================

function JdAnalyzer({ resume }: { resume: ResumeDetail | null }) {
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<JdParseResponse | null>(null);
  const [match, setMatch] = useState<SkillMatchResponse | null>(null);

  const run = async () => {
    if (jd.trim().length < 10) {
      message.warning('请先粘贴岗位 JD');
      return;
    }
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        aiApi.parseJd(jd),
        aiApi.matchSkills(resumeToPlainText(resume), jd),
      ]);
      setParsed(p);
      setMatch(m);
    } catch {
      /* handled */
    } finally {
      setLoading(false);
    }
  };

  const matchColor =
    (match?.matchRate ?? 0) >= 75
      ? semantic.success
      : (match?.matchRate ?? 0) >= 50
        ? brand.primary
        : semantic.warning;

  return (
    <div>
      <BlockTitle
        icon={<FileSearchOutlined />}
        title="JD 解析与技能匹配"
        desc="拆解岗位要求里的关键词，并算出你的简历命中了多少。"
      />

      <Input.TextArea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="粘贴岗位 JD…"
        autoSize={{ minRows: 4, maxRows: 9 }}
        style={{ fontSize: 12.5, lineHeight: 1.75 }}
      />

      <Button
        block
        loading={loading}
        onClick={run}
        style={{ marginTop: 10, height: 34, fontSize: 12.5 }}
      >
        {loading ? '解析中…' : '解析并匹配'}
      </Button>

      {match && !loading && (
        <div style={{ marginTop: 16 }} className="animate-fade">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '12px 14px',
              borderRadius: radius.lg,
              background: `${matchColor}0D`,
              border: `1px solid ${matchColor}30`,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: matchColor,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(match.matchRate)}%
            </span>
            <span style={{ fontSize: 12, color: neutral[500], flex: 1 }}>
              技能匹配度
              <br />
              命中 {match.matched.length} 项 · 缺失 {match.missing.length} 项
            </span>
            <EngineBadge engine={match.engine} />
          </div>

          {!!match.missing.length && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: neutral[600], marginBottom: 7 }}>
                建议补充进简历
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {match.missing.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 9px',
                      borderRadius: radius.pill,
                      background: semantic.dangerSoft,
                      color: semantic.danger,
                      fontSize: 11.5,
                    }}
                  >
                    + {s}
                  </span>
                ))}
              </div>
            </>
          )}

          {!!match.matched.length && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: neutral[600], marginBottom: 7 }}>
                已命中
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {match.matched.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 9px',
                      borderRadius: radius.pill,
                      background: semantic.successSoft,
                      color: semantic.success,
                      fontSize: 11.5,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {parsed && !loading && (
        <div style={{ marginTop: 6 }} className="animate-fade">
          <BlockTitle
            icon={<ExperimentOutlined />}
            title="岗位画像"
            extra={<EngineBadge engine={parsed.engine} />}
          />

          <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
            {parsed.years && (
              <div
                style={{
                  flex: 1,
                  padding: '8px 11px',
                  background: neutral[25],
                  borderRadius: radius.md,
                  border: `1px solid ${neutral[150]}`,
                }}
              >
                <div style={{ fontSize: 10.5, color: neutral[400], marginBottom: 3 }}>经验要求</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: neutral[800] }}>
                  {parsed.years}
                </div>
              </div>
            )}
            {parsed.education && (
              <div
                style={{
                  flex: 1,
                  padding: '8px 11px',
                  background: neutral[25],
                  borderRadius: radius.md,
                  border: `1px solid ${neutral[150]}`,
                }}
              >
                <div style={{ fontSize: 10.5, color: neutral[400], marginBottom: 3 }}>学历要求</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: neutral[800] }}>
                  {parsed.education}
                </div>
              </div>
            )}
          </div>

          {!!parsed.skills.length && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: neutral[600], marginBottom: 7 }}>
                核心技能关键词
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {parsed.skills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 9px',
                      borderRadius: radius.xs,
                      background: brand.primarySoft,
                      border: `1px solid ${brand.primaryBorder}`,
                      color: brand.primaryActive,
                      fontSize: 11.5,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          {!!parsed.responsibilities.length && (
            <ResponsibilityList title="主要职责" items={parsed.responsibilities} />
          )}
          {!!parsed.requirements.length && (
            <ResponsibilityList title="任职要求" items={parsed.requirements} />
          )}
        </div>
      )}

      {!parsed && !match && !loading && <PanelEmpty text="粘贴一段 JD 后点击「解析并匹配」。" />}
    </div>
  );
}

function ResponsibilityList({ title, items }: { title: string; items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 3);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: neutral[600], marginBottom: 7 }}>
        {title}
      </div>
      {shown.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 7,
            fontSize: 12,
            lineHeight: 1.75,
            color: neutral[600],
            marginBottom: 5,
          }}
        >
          <span style={{ color: neutral[300] }}>·</span>
          <span style={{ flex: 1 }}>{r}</span>
        </div>
      ))}
      {items.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            border: 'none',
            background: 'transparent',
            color: brand.primary,
            fontSize: 11.5,
            cursor: 'pointer',
            padding: '2px 0 0 14px',
          }}
        >
          {expanded ? '收起' : `展开全部 ${items.length} 条`}
        </button>
      )}
    </div>
  );
}

// ==================================================================
// 4. 面试预测
// ==================================================================

function InterviewPanel({ resume }: { resume: ResumeDetail | null }) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [engine, setEngine] = useState<AiEngine | undefined>();
  const [asked, setAsked] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await aiApi.interviewQuestions(
        resume?.targetJob || '目标岗位',
        resumeToPlainText(resume)
      );
      setQuestions(res.questions);
      setEngine(res.engine);
      setAsked(true);
    } catch {
      /* handled */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <BlockTitle
        icon={<RobotOutlined />}
        title="模拟面试题"
        desc="基于你简历中的技术栈与项目经历，预测面试官可能追问的问题。先用它自测一遍。"
      />

      <Button
        type="primary"
        block
        loading={loading}
        onClick={run}
        icon={loading ? undefined : <RobotOutlined />}
        style={{
          background: loading ? undefined : brand.gradient,
          border: 'none',
          height: 34,
          fontSize: 12.5,
        }}
      >
        {loading ? '正在生成…' : asked ? '重新生成' : `针对「${resume?.targetJob || '目标岗位'}」出题`}
      </Button>

      <div style={{ marginTop: 14 }}>
        {questions.length > 0 && (
          <>
            <BlockTitle
              icon={<BulbOutlined />}
              title={`共 ${questions.length} 题`}
              extra={<EngineBadge engine={engine} />}
            />
            {questions.map((q, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 9,
                  padding: '10px 12px',
                  background: '#fff',
                  border: `1px solid ${neutral[150]}`,
                  borderRadius: radius.md,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: brand.primarySoft,
                    color: brand.primary,
                    fontSize: 10.5,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.8, color: neutral[700], flex: 1 }}>
                  {q}
                </span>
              </div>
            ))}
          </>
        )}
        {asked && !loading && questions.length === 0 && (
          <PanelEmpty text="没有生成题目，请先完善简历内容后重试。" />
        )}
        {!asked && !loading && <PanelEmpty text="点击上方按钮，让 AI 扮演面试官出题。" />}
      </div>
    </div>
  );
}

// ==================================================================
// 主组件
// ==================================================================

type AiTab = 'optimize' | 'ats' | 'jd' | 'interview';

interface Props {
  resume: ResumeDetail | null;
  /** 把生成的总结写进「个人总结」模块 */
  onApplySummary: (text: string) => void;
  /** 批量优化要点 */
  onApplyBullets: (pairs: { before: string; after: string }[]) => void;
}

export default function AiPanel({ resume, onApplySummary }: Props) {
  const [tab, setTab] = useState<AiTab>('optimize');
  const [health, setHealth] = useState<{ engine: AiEngine; llmEnabled: boolean } | null>(null);

  useEffect(() => {
    aiApi
      .health()
      .then((h) => setHealth({ engine: h.engine, llmEnabled: h.llmEnabled }))
      .catch(() => setHealth(null));
  }, []);

  const tabs: { key: AiTab; label: string; icon: React.ReactNode }[] = [
    { key: 'optimize', label: '内容', icon: <BulbOutlined /> },
    { key: 'ats', label: 'ATS', icon: <RiseOutlined /> },
    { key: 'jd', label: '岗位', icon: <FileSearchOutlined /> },
    { key: 'interview', label: '面试', icon: <RobotOutlined /> },
  ];

  const noResume = !resume;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 引擎状态条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 14px',
          borderBottom: `1px solid ${neutral[150]}`,
          background: health?.llmEnabled ? `${brand.primary}08` : neutral[25],
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: health?.llmEnabled ? semantic.success : neutral[300],
            boxShadow: health?.llmEnabled ? `0 0 0 3px ${semantic.success}22` : 'none',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11.5, color: neutral[500], flex: 1, lineHeight: 1.5 }}>
          {health === null
            ? '正在检测 AI 服务…'
            : health.llmEnabled
              ? '大模型已接入，建议质量更佳'
              : '未配置密钥，使用本地规则引擎'}
        </span>
        {health?.engine && <EngineBadge engine={health.engine} />}
      </div>

      {/* 页签 */}
      <div
        style={{
          display: 'flex',
          padding: '0 6px',
          borderBottom: `1px solid ${neutral[150]}`,
          flexShrink: 0,
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '10px 0 9px',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? brand.primary : neutral[500],
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderBottom: `2px solid ${active ? brand.primary : 'transparent'}`,
                marginBottom: -1,
                transition: transition.fast,
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 内容 */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {noResume ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ fontSize: 12.5, color: neutral[400] }}>简历加载中…</span>}
          />
        ) : (
          <div key={tab} className="animate-fade">
            {tab === 'optimize' && (
              <ContentOptimizer
                resume={resume}
                onGenerateSummary={onApplySummary}
                onOptimizeBullets={() => undefined}
              />
            )}
            {tab === 'ats' && <AtsChecker resume={resume} />}
            {tab === 'jd' && <JdAnalyzer resume={resume} />}
            {tab === 'interview' && <InterviewPanel resume={resume} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// AI 优化弹窗（供 SectionContentEditor 的「优化」按钮调用）
// ==================================================================

export function AiOptimizeModal({
  open,
  source,
  jobTitle,
  onClose,
  onApply,
}: {
  open: boolean;
  source: string;
  jobTitle?: string;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [engine, setEngine] = useState<AiEngine | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !source.trim()) return;
    let cancelled = false;
    setLoading(true);
    setResult('');
    setError('');
    aiApi
      .optimizeBullet(source, jobTitle)
      .then((res) => {
        if (cancelled) return;
        setResult(res.result);
        setEngine(res.engine);
      })
      .catch(() => {
        if (!cancelled) setError('优化失败，请稍后重试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source, jobTitle]);

  const beforeLen = useMemo(() => plainText(source).length, [source]);
  const afterLen = useMemo(() => plainText(result).length, [result]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltFilled style={{ color: brand.primary }} />
          AI 优化这段描述
          <EngineBadge engine={engine} />
        </span>
      }
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="retry"
          icon={<ReloadOutlined />}
          onClick={() => {
            setResult('');
            setLoading(true);
            aiApi
              .optimizeBullet(source, jobTitle)
              .then((res) => {
                setResult(res.result);
                setEngine(res.engine);
              })
              .catch(() => setError('优化失败，请稍后重试'))
              .finally(() => setLoading(false));
          }}
          disabled={loading}
        >
          换个说法
        </Button>,
        <Button
          key="apply"
          type="primary"
          disabled={!result || loading}
          onClick={() => {
            onApply(result);
            onClose();
            message.success('已应用到简历');
          }}
          style={{ background: brand.gradient, border: 'none' }}
        >
          应用优化结果
        </Button>,
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              color: neutral[500],
              marginBottom: 7,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>原文</span>
            <span style={{ color: neutral[400] }}>{beforeLen} 字</span>
          </div>
          <div
            style={{
              padding: '11px 13px',
              background: neutral[25],
              border: `1px solid ${neutral[150]}`,
              borderRadius: radius.lg,
              fontSize: 12.5,
              lineHeight: 1.85,
              color: neutral[600],
              minHeight: 150,
              whiteSpace: 'pre-wrap',
            }}
          >
            {source}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              color: neutral[500],
              marginBottom: 7,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>优化后</span>
            {!!afterLen && (
              <span style={{ color: semantic.success }}>{afterLen} 字</span>
            )}
          </div>
          <div
            style={{
              padding: '11px 13px',
              background: loading ? neutral[25] : brand.primarySoft,
              border: `1px solid ${loading ? neutral[150] : brand.primaryBorder}`,
              borderRadius: radius.lg,
              fontSize: 12.5,
              lineHeight: 1.85,
              color: neutral[800],
              minHeight: 150,
              whiteSpace: 'pre-wrap',
            }}
          >
            {loading ? (
              <span style={{ color: neutral[400], display: 'flex', alignItems: 'center', gap: 8 }}>
                <LoadingOutlined spin style={{ color: brand.primary }} />
                正在重写…
              </span>
            ) : error ? (
              <span style={{ color: semantic.danger }}>{error}</span>
            ) : (
              result
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 13px',
          background: semantic.warningSoft,
          border: `1px solid ${semantic.warning}30`,
          borderRadius: radius.md,
          fontSize: 11.5,
          color: neutral[600],
          lineHeight: 1.75,
        }}
      >
        <strong style={{ color: semantic.warningStrong }}>提示：</strong>
        如果优化后出现了你并未掌握的技能，请务必手动删掉 —— 面试会追问细节。
        建议保留你真实的量化数据。
      </div>
      <div style={{ marginTop: 10, ...{ boxShadow: shadow.xs, borderRadius: radius.md } }} />
    </Modal>
  );
}
