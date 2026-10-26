/**
 * 模块内容编辑器
 * ------------------------------------------------------------------
 * 职责：把某个模块的 `data` 渲染成表单，并把用户的每次改动回传给上层。
 *
 * 约定：
 *   1. 本组件不直接落库 —— 所有改动通过 onChange 上抛，
 *      由 Editor 页面统一做「更新可撤销草稿，显式保存才提交」。
 *   2. 必须保留 `data._config` —— 每次 onChange 都在原有 data 基础上展开，
 *      因此样式面板设置的排版参数不会被内容编辑覆盖。
 *   3. 空模块给出引导 —— listLike 模块默认带一条空记录，
 *      非列表模块给出写作提示，降低「不知道怎么开始」的阻力。
 *
 * 支持的模块类型：
 *   basic / summary / custom        —— 键值对 + 长文本
 *   experience / work / projects    —— 列表：机构 + 职位 + 时间 + 要点
 *   education                       —— 列表：学校 + 学历 + 专业 + 时间
 *   awards / certificates           —— 列表：名称 + 级别 + 时间
 *   skills                          —— 标签模式 / 分组模式
 */
import { useMemo, useRef, useState } from 'react';
import { Dropdown, Input, Tooltip, type InputRef } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import MarkdownEditor from './MarkdownEditor';
import RichTextEditor from './RichTextEditor';
import {
  appendBullet,
  appendItem,
  duplicateItem,
  isGroupedSkills,
  moveItem,
  patchBullet,
  patchItem,
  readConfig,
  readItems,
  readLinks,
  readSkillGroups,
  readSkillTags as readSkillTagsRaw,
  removeBullet,
  removeItem,
  toGroupedSkills,
  writeConfig,
  writeLinks,
  writeSkillGroups,
  writeSkillTags,
} from './sectionData';

/**
 * 技能标签读取：data.items 在切换「标签 / 分组」形态的瞬间可能是混合的，
 * 先过滤出字符串项，保证渲染始终是 string[]。
 */
const readSkillTags = (data: SectionData | undefined): string[] => readSkillTagsRaw(data);

import { Field, EmptyBlock, SegmentedField, useTextLength } from './EditorControls';
import SectionIcon from '../common/SectionIcon';
import { SECTION_META } from '../../constants/sections';
import {
  normalizeSectionData,
  type ResumeItem,
  type SectionData,
  type SectionType,
  type SkillGroup,
} from '../../types/resume';
import { brand, neutral, radius, semantic, shadow, transition } from '../../styles/tokens';
import { plainText, toDayDate } from '../../utils/thumbnail';

// ==================================================================
// Props
// ==================================================================

interface Props {
  sectionType: SectionType;
  data: SectionData;
  onChange: (data: SectionData) => void;
  /** 供「AI 优化」使用：目标岗位 */
  jobTitle?: string;
  /** 请求 AI 优化某段文本，返回优化后的文本（由上层弹窗处理） */
  onOptimize?: (text: string, produce: (result: string) => SectionData) => void;
}

// ==================================================================
// 小型复用组件
// ==================================================================

/** 行内「AI 优化」按钮 */
function AiButton({ onClick, tip }: { onClick: () => void; tip?: string }) {
  return (
    <Tooltip title={tip || 'AI 优化这段描述'} mouseEnterDelay={0.35}>
      <button
        aria-label={tip || 'AI 优化这段描述'}
        onClick={onClick}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: brand.primary,
          fontSize: 11.5,
          padding: '2px 5px',
          borderRadius: radius.xs,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          transition: transition.fast,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = brand.primarySoft;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <ThunderboltOutlined style={{ fontSize: 11 }} />
        优化
      </button>
    </Tooltip>
  );
}

/** 时间区间输入：起止日期均可自由选择；「至今」只是可选开关，不占用结束日期框 */
function DateRange({
  start,
  end,
  current,
  onChange,
  allowPresent = false,
}: {
  start?: string;
  end?: string;
  current?: boolean;
  onChange: (patch: { startDate?: string; endDate?: string; current?: boolean }) => void;
  allowPresent?: boolean;
}) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);

  // 「至今」由 current 显式标记，不再用「结束日期为空」推断
  const isPresent = allowPresent && Boolean(current) && !end;

  /** 用 antd 的 DatePicker 太重，这里用原生 month input：轻、准、无依赖 */
  const renderInput = (which: 'start' | 'end') => {
    const value = which === 'start' ? start : end;
    const isEditing = editing === which;

    if (isEditing) {
      return (
        <input
          type="month"
          autoFocus
          defaultValue={toMonthInput(value)}
          onBlur={(e) => {
            const next = fromMonthInput(e.target.value);
            if (which === 'start') {
              onChange({ startDate: next });
            } else {
              // 填了结束日期就退出「至今」
              onChange({ endDate: next, current: false });
            }
            setEditing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(null);
          }}
          style={{
            border: `1px solid ${brand.primary}`,
            borderRadius: radius.sm,
            padding: '2px 6px',
            fontSize: 12.5,
            width: 116,
            outline: 'none',
            background: '#fff',
          }}
        />
      );
    }

    return (
      <button
        onClick={() => setEditing(which)}
        style={{
          border: 'none',
          borderBottom: `1px dashed ${neutral[300]}`,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 12.5,
          color: value ? neutral[600] : neutral[400],
          padding: '1px 2px',
          minWidth: 76,
          textAlign: 'left',
        }}
      >
        {value || (which === 'start' ? '开始时间' : '结束时间')}
      </button>
    );
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {renderInput('start')}
      <span style={{ color: neutral[300], fontSize: 12 }}>—</span>
      {isPresent ? (
        <button
          onClick={() => onChange({ endDate: '', current: false })}
          title="改为填写结束日期"
          style={{
            border: 'none',
            background: brand.primarySoft,
            color: brand.primary,
            borderRadius: radius.xs,
            padding: '1px 7px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          至今
        </button>
      ) : (
        renderInput('end')
      )}
      {allowPresent && (
        <Tooltip title={isPresent ? '改为填写结束日期' : '设为「至今」'} mouseEnterDelay={0.35}>
          <button
            onClick={() =>
              isPresent
                ? onChange({ endDate: end || '', current: false })
                : onChange({ endDate: '', current: true })
            }
            style={{
              border: `1px ${isPresent ? 'solid' : 'dashed'} ${isPresent ? brand.primaryBorder : neutral[200]}`,
              background: isPresent ? brand.primarySoft : 'transparent',
              color: isPresent ? brand.primary : neutral[400],
              borderRadius: radius.xs,
              padding: '1px 6px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            至今
          </button>
        </Tooltip>
      )}
    </span>
  );
}

/** `YYYY-MM` ⇄ `<input type="month">` */
function toMonthInput(value?: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}` : '';
}

function fromMonthInput(value: string): string {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM') : value;
}

/** 字数提示 */
function CountHint({ text, ideal }: { text: unknown; ideal?: [number, number] }) {
  const len = useTextLength(text);
  if (!len) return null;
  const [min, max] = ideal || [0, 0];
  let color: string = neutral[400];
  let suffix = '';
  if (min && len < min) {
    color = semantic.warning;
    suffix = ` · 建议 ${min} 字以上`;
  } else if (max && len > max) {
    color = semantic.warning;
    suffix = ` · 建议不超过 ${max} 字`;
  } else if (min) {
    color = semantic.success;
  }
  return (
    <span style={{ fontSize: 11, color }}>
      {len} 字{suffix}
    </span>
  );
}

/** 段落标题（列表型模块内的小标题） */
function BlockHeading({
  children,
  extra,
  onAdd,
}: {
  children: React.ReactNode;
  extra?: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <span style={{ fontSize: 12.5, color: neutral[500], fontWeight: 500 }}>{children}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {extra}
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              border: `1px solid ${brand.primaryBorder}`,
              background: '#fff',
              color: brand.primary,
              borderRadius: radius.md,
              padding: '3px 10px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: transition.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = brand.primarySoft;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
          >
            <PlusOutlined style={{ fontSize: 10 }} />
            添加
          </button>
        )}
      </span>
    </div>
  );
}

// ==================================================================
// 列表条目外壳：悬浮显示操作条
// ==================================================================

function ItemShell({
  index,
  total,
  onMove,
  onDuplicate,
  onRemove,
  children,
  label,
}: {
  index: number;
  total: number;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const [hover, setHover] = useState(false);

  const menu = [
    {
      key: 'up',
      icon: <ArrowUpOutlined />,
      label: '上移',
      disabled: index === 0,
      onClick: () => onMove(-1),
    },
    {
      key: 'down',
      icon: <ArrowDownOutlined />,
      label: '下移',
      disabled: index === total - 1,
      onClick: () => onMove(1),
    },
    { type: 'divider' as const },
    {
      key: 'dup',
      icon: <CopyOutlined />,
      label: '复制此条',
      onClick: onDuplicate,
    },
    { type: 'divider' as const },
    {
      key: 'del',
      icon: <DeleteOutlined />,
      label: '删除此条',
      danger: true,
      onClick: onRemove,
    },
  ];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        border: `1px solid ${hover ? brand.primaryBorder : neutral[150]}`,
        borderRadius: radius.lg,
        padding: '14px 15px 12px',
        marginBottom: 12,
        background: hover ? neutral[25] : neutral[0],
        transition: transition.fast,
      }}
    >
      {/* 悬浮操作条 */}
      <div
        style={{
          position: 'absolute',
          top: -11,
          right: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: '#fff',
          border: `1px solid ${neutral[200]}`,
          borderRadius: radius.pill,
          padding: '1px 4px',
          boxShadow: shadow.sm,
          opacity: hover ? 1 : 0,
          pointerEvents: hover ? 'auto' : 'none',
          transition: transition.fast,
          zIndex: 2,
        }}
      >
        <Tooltip title="拖拽手柄（用菜单调整顺序）" mouseEnterDelay={0.4}>
          <span
            style={{
              color: neutral[300],
              fontSize: 11,
              display: 'flex',
              padding: '0 3px',
              cursor: 'grab',
            }}
          >
            <HolderOutlined />
          </span>
        </Tooltip>
        <span className="toolbar-divider" style={{ height: 14, margin: '0 2px' }} />
        <span
          style={{
            fontSize: 10.5,
            color: neutral[400],
            padding: '0 5px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <Dropdown menu={{ items: menu }} trigger={['click']} placement="bottomRight">
          <button
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: neutral[500],
              fontSize: 13,
              lineHeight: 1,
              padding: '2px 5px',
              display: 'flex',
            }}
          >
            <MoreOutlined />
          </button>
        </Dropdown>
      </div>

      {children}
    </div>
  );
}

// ==================================================================
// 要点编辑器
// ==================================================================

function BulletsEditor({
  item,
  itemIndex,
  data,
  onChange,
  onOptimize,
  placeholder,
}: {
  item: ResumeItem;
  itemIndex: number;
  data: SectionData;
  onChange: (data: SectionData) => void;
  onOptimize?: Props['onOptimize'];
  placeholder?: string;
}) {
  const bullets = item.bullets && item.bullets.length ? item.bullets : [''];

  return (
    <div style={{ marginTop: 10 }}>
      {bullets.map((bullet, bi) => (
        <div
          key={bi}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 7,
            marginBottom: 5,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: neutral[300],
              marginTop: 9,
              flexShrink: 0,
            }}
          />
          <Input.TextArea
            value={bullet}
            onChange={(e) => onChange(patchBullet(data, itemIndex, bi, e.target.value))}
            placeholder={placeholder || '描述你做了什么、用了什么方法、拿到了什么结果（建议量化）'}
            autoSize={{ minRows: 1, maxRows: 6 }}
            variant="borderless"
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              padding: '3px 6px',
              background: 'transparent',
              flex: 1,
            }}
          />
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              paddingTop: 4,
            }}
          >
            {onOptimize && bullet.trim().length > 6 && (
              <AiButton
                onClick={() =>
                  onOptimize(bullet, (result) => patchBullet(data, itemIndex, bi, result))
                }
              />
            )}
            <Tooltip title="删除这一条要点" mouseEnterDelay={0.4}>
              <button
                onClick={() => onChange(removeBullet(data, itemIndex, bi))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: neutral[300],
                  fontSize: 12,
                  padding: 3,
                  display: 'flex',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = semantic.danger;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = neutral[300];
                }}
              >
                <DeleteOutlined />
              </button>
            </Tooltip>
          </span>
        </div>
      ))}

      <button
        onClick={() => onChange(appendBullet(data, itemIndex))}
        style={{
          border: 'none',
          background: 'transparent',
          color: neutral[400],
          fontSize: 12,
          cursor: 'pointer',
          padding: '4px 0 0 12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = brand.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = neutral[400];
        }}
      >
        <PlusOutlined style={{ fontSize: 10 }} />
        添加一条要点
      </button>
    </div>
  );
}

// ==================================================================
// 基础信息
// ==================================================================

function BasicEditor({ data, onChange }: { data: SectionData; onChange: (d: SectionData) => void }) {
  const d = normalizeSectionData(data);
  const links = readLinks(data);

  const set = (key: string, value: unknown) => onChange({ ...d, [key]: value });

  return (
    <div>
      <BlockHeading>联系方式</BlockHeading>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <Field label="姓名" required>
          <Input
            value={String(d.name || '')}
            onChange={(e) => set('name', e.target.value)}
            placeholder="张三"
            variant="borderless"
            style={{ padding: '3px 6px', background: neutral[25], fontSize: 13.5 }}
          />
        </Field>
        <Field label="求职意向 / 目标岗位" hint="会显示在姓名下方，也是 AI 优化的依据">
          <Input
            value={String(d.jobTitle || '')}
            onChange={(e) => set('jobTitle', e.target.value)}
            placeholder="Java 后端开发工程师"
            variant="borderless"
            style={{ padding: '3px 6px', background: neutral[25], fontSize: 13.5 }}
          />
        </Field>
        <Field label="手机号">
          <Input
            value={String(d.phone || '')}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="138 0000 0000"
            variant="borderless"
            style={{ padding: '3px 6px', background: neutral[25], fontSize: 13.5 }}
          />
        </Field>
        <Field label="邮箱">
          <Input
            value={String(d.email || '')}
            onChange={(e) => set('email', e.target.value)}
            placeholder="zhangsan@example.com"
            variant="borderless"
            style={{ padding: '3px 6px', background: neutral[25], fontSize: 13.5 }}
          />
        </Field>
        <Field label="所在城市">
          <Input
            value={String(d.city || '')}
            onChange={(e) => set('city', e.target.value)}
            placeholder="上海"
            variant="borderless"
            style={{ padding: '3px 6px', background: neutral[25], fontSize: 13.5 }}
          />
        </Field>
        <Field label="个人主页 / GitHub" hint="一行一个，可写多个">
          <Input
            value={String(d.website || '')}
            onChange={(e) => set('website', e.target.value)}
            placeholder="github.com/xxx"
            variant="borderless"
            style={{ padding: '3px 6px', background: neutral[25], fontSize: 13.5 }}
          />
        </Field>
      </div>

      <div style={{ marginTop: 6 }}>
        <BlockHeading
          onAdd={() => onChange(writeLinks(data, [...links, { label: '', url: '' }]))}
          extra={<span style={{ fontSize: 11, color: neutral[400] }}>作品集 / 博客 / 掘金等</span>}
        >
          其他链接
        </BlockHeading>

        {links.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: neutral[400],
              padding: '10px 12px',
              background: neutral[25],
              borderRadius: radius.md,
              textAlign: 'center',
            }}
          >
            暂无额外链接，点击「添加」补充
          </div>
        ) : (
          links.map((link, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
              <Input
                value={link.label}
                onChange={(e) =>
                  onChange(
                    writeLinks(
                      data,
                      links.map((l, li) => (li === i ? { ...l, label: e.target.value } : l))
                    )
                  )
                }
                placeholder="名称"
                style={{ width: 110, fontSize: 12.5 }}
              />
              <Input
                value={link.url}
                onChange={(e) =>
                  onChange(
                    writeLinks(
                      data,
                      links.map((l, li) => (li === i ? { ...l, url: e.target.value } : l))
                    )
                  )
                }
                placeholder="https://..."
                style={{ flex: 1, fontSize: 12.5 }}
              />
              <button
                onClick={() => onChange(writeLinks(data, links.filter((_, li) => li !== i)))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: neutral[400],
                  cursor: 'pointer',
                  padding: '0 6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = semantic.danger;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = neutral[400];
                }}
              >
                <DeleteOutlined />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==================================================================
// 长文本模块：个人总结 / 自定义
// ==================================================================

function TextEditor({
  data,
  onChange,
  sectionType,
  onOptimize,
}: {
  data: SectionData;
  onChange: (d: SectionData) => void;
  sectionType: SectionType;
  onOptimize?: Props['onOptimize'];
}) {
  const d = normalizeSectionData(data);
  const cfg = readConfig(data);
  const content = String(d.content || '');
  const markdownMode = cfg.markdownMode !== false; // 默认 Markdown：更适合长文本

  const placeholder =
    sectionType === 'summary'
      ? '用 3-4 句话概括你的核心竞争力：\n\n· 几年什么方向的经验，擅长什么技术栈\n· 做过最有代表性的项目与量化成果\n· 你希望寻找什么样的岗位'
      : '支持 Markdown：## 二级标题、- 列表、**加粗**、[链接](url) 等';

  return (
    <div>
      <BlockHeading
        extra={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CountHint text={content} ideal={sectionType === 'summary' ? [80, 220] : undefined} />
            {onOptimize && plainText(content).length > 20 && (
              <AiButton
                tip="AI 润色这段内容"
                onClick={() =>
                  onOptimize(content, (result) => ({ ...d, content: result }))
                }
              />
            )}
          </span>
        }
      >
        {sectionType === 'summary' ? '自我评价' : '模块内容'}
      </BlockHeading>

      {markdownMode ? (
        <MarkdownEditor
          value={content}
          onChange={(v) => onChange({ ...d, content: v })}
          placeholder={placeholder}
          minRows={8}
          maxRows={26}
        />
      ) : (
        <RichTextEditor
          value={content}
          onChange={(v) => onChange({ ...d, content: v })}
          placeholder={placeholder}
          minHeight={200}
        />
      )}

      <div style={{ marginTop: 10 }}>
        <SegmentedField
          label="编辑模式"
          value={markdownMode ? 'md' : 'rich'}
          onChange={(v) => onChange(writeConfig(data, { markdownMode: v === 'md' }))}
          options={[
            { label: 'Markdown', value: 'md' },
            { label: '富文本', value: 'rich' },
          ]}
          block={false}
        />
      </div>

      {sectionType === 'summary' && (
        <div
          style={{
            fontSize: 11.5,
            color: neutral[500],
            background: brand.primarySoft,
            border: `1px solid ${brand.primaryBorder}`,
            borderRadius: radius.md,
            padding: '9px 12px',
            lineHeight: 1.75,
          }}
        >
          <strong style={{ color: brand.primaryActive }}>写作建议：</strong>
          避免「性格开朗、学习能力强」这类空泛描述。用「岗位关键词 + 具体技术 + 量化结果」的句式，
          让 HR 在 10 秒内看到你与岗位的匹配度。
        </div>
      )}
    </div>
  );
}

// ==================================================================
// 技能模块
// ==================================================================

function SkillsEditor({ data, onChange }: { data: SectionData; onChange: (d: SectionData) => void }) {
  const grouped = isGroupedSkills(data);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<InputRef>(null);

  const tags = useMemo<string[]>(() => readSkillTags(data), [data]);
  const groups = useMemo(() => readSkillGroups(data), [data]);

  const commitDraft = () => {
    const value = draft.trim();
    if (!value) return;
    // 支持一次粘贴多个：用逗号 / 顿号 / 竖线分隔
    const parts = value
      .split(/[,，、|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = Array.from(new Set([...tags, ...parts]));
    onChange(writeSkillTags(data, next));
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <div>
      <BlockHeading
        extra={
          <SegmentedField
            value={grouped ? 'group' : 'tag'}
            onChange={(v) =>
              onChange(v === 'group' ? toGroupedSkills(data) : writeSkillTags(data, readSkillTags(data)))
            }
            options={[
              { label: '标签', value: 'tag' },
              { label: '分组', value: 'group' },
            ]}
            block={false}
          />
        }
      >
        {grouped ? '按分类组织技能' : '技能标签'}
      </BlockHeading>

      {!grouped ? (
        <>
          {/* 标签输入 */}
          <div
            style={{
              border: `1px solid ${neutral[200]}`,
              borderRadius: radius.lg,
              padding: 10,
              minHeight: 76,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 7,
              alignContent: 'flex-start',
              background: '#fff',
            }}
          >
            {tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 6px 3px 10px',
                  borderRadius: radius.pill,
                  background: brand.primarySoft,
                  border: `1px solid ${brand.primaryBorder}`,
                  color: brand.primaryActive,
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                {tag}
                <button
                  onClick={() => onChange(writeSkillTags(data, tags.filter((_, ti) => ti !== i)))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: brand.primary,
                    cursor: 'pointer',
                    fontSize: 11,
                    lineHeight: 1,
                    padding: 2,
                    display: 'flex',
                    opacity: 0.6,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                  }}
                >
                  ✕
                </button>
              </span>
            ))}

            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPressEnter={commitDraft}
              onBlur={commitDraft}
              placeholder={tags.length ? '继续添加…' : '输入技能后回车，如：Java、Spring Boot'}
              variant="borderless"
              style={{ flex: 1, minWidth: 190, fontSize: 13, padding: '3px 4px' }}
            />
          </div>
          <div style={{ fontSize: 11.5, color: neutral[400], marginTop: 7, lineHeight: 1.7 }}>
            回车添加；支持一次粘贴多个（用逗号、顿号或竖线分隔）。建议与目标岗位 JD 的关键词对齐。
          </div>
        </>
      ) : (
        <>
          {groups.map((group, gi) => (
            <div
              key={gi}
              style={{
                border: `1px solid ${neutral[150]}`,
                borderRadius: radius.lg,
                padding: '11px 13px',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Input
                  value={group.name || ''}
                  onChange={(e) =>
                    onChange(
                      writeSkillGroups(
                        data,
                        groups.map((g, i) => (i === gi ? { ...g, name: e.target.value } : g))
                      )
                    )
                  }
                  placeholder="分类名称，如：编程语言"
                  variant="borderless"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '2px 6px',
                    background: neutral[25],
                    maxWidth: 180,
                  }}
                />
                <span style={{ flex: 1 }} />
                <Tooltip title="删除该分类" mouseEnterDelay={0.4}>
                  <button
                    onClick={() =>
                      onChange(writeSkillGroups(data, groups.filter((_, i) => i !== gi)))
                    }
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: neutral[400],
                      cursor: 'pointer',
                      padding: 3,
                      display: 'flex',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = semantic.danger;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = neutral[400];
                    }}
                  >
                    <DeleteOutlined />
                  </button>
                </Tooltip>
              </div>

              <SkillTagRow
                items={group.items || []}
                onChange={(items) =>
                  onChange(
                    writeSkillGroups(
                      data,
                      groups.map((g, i) => (i === gi ? { ...g, items } : g))
                    )
                  )
                }
              />
            </div>
          ))}

          <button
            onClick={() =>
              onChange(writeSkillGroups(data, [...groups, { name: '新分类', items: [] }]))
            }
            style={{
              width: '100%',
              border: `1px dashed ${neutral[200]}`,
              background: 'transparent',
              color: neutral[500],
              borderRadius: radius.lg,
              padding: '9px 0',
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            <PlusOutlined style={{ fontSize: 11, marginRight: 5 }} />
            添加分类
          </button>
        </>
      )}
    </div>
  );
}

/** 分组模式下的标签行 */
function SkillTagRow({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (!value) return;
    const parts = value
      .split(/[,，、|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(Array.from(new Set([...items, ...parts])));
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
      {items.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 5px 2px 9px',
            borderRadius: radius.pill,
            background: neutral[100],
            color: neutral[700],
            fontSize: 12.5,
          }}
        >
          {tag}
          <button
            onClick={() => onChange(items.filter((_, ti) => ti !== i))}
            style={{
              border: 'none',
              background: 'transparent',
              color: neutral[400],
              cursor: 'pointer',
              fontSize: 10,
              padding: 2,
              lineHeight: 1,
              display: 'flex',
            }}
          >
            ✕
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={commit}
        onBlur={commit}
        placeholder="回车添加"
        variant="borderless"
        style={{ width: 130, fontSize: 12.5, padding: '2px 4px' }}
      />
    </div>
  );
}

// ==================================================================
// 经历型列表（experience / work / projects）
// ==================================================================

function ExperienceEditor({
  data,
  onChange,
  sectionType,
  onOptimize,
}: {
  data: SectionData;
  onChange: (d: SectionData) => void;
  sectionType: SectionType;
  onOptimize?: Props['onOptimize'];
}) {
  const items = readItems(data);
  const isProject = sectionType === 'projects';

  const hints = {
    experience: { org: '公司名称', orgPh: '字节跳动', pos: '实习岗位', posPh: '后端开发实习生' },
    work: { org: '公司名称', orgPh: '阿里巴巴', pos: '职位', posPh: 'Java 开发工程师' },
    projects: { org: '项目名称', orgPh: '简历助手 · 在线简历平台', pos: '担任角色', posPh: '后端负责人' },
  }[sectionType as 'experience' | 'work' | 'projects'] || {
    org: '名称',
    orgPh: '',
    pos: '职位',
    posPh: '',
  };

  return (
    <div>
      <BlockHeading
        onAdd={() => onChange(appendItem(data, sectionType))}
        extra={
          <span style={{ fontSize: 11, color: neutral[400] }}>{items.length} 条记录</span>
        }
      >
        {isProject ? '项目列表' : '经历列表'}
      </BlockHeading>

      {items.length === 0 ? (
        <EmptyBlock
          compact
          icon="🏆"
          title="还没有记录"
          description={`用 STAR 法则描述这段经历：背景（Situation）→ 任务（Task）→ 行动（Action）→ 结果（Result）。`}
        />
      ) : (
        items.map((item, index) => (
          <ItemShell
            key={index}
            index={index}
            total={items.length}
            label={`第 ${index + 1} 条`}
            onMove={(delta) => onChange(moveItem(data, index, delta))}
            onDuplicate={() => onChange(duplicateItem(data, index))}
            onRemove={() => onChange(removeItem(data, index))}
          >
            {/* 第一行：机构 + 时间 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Input
                value={String((isProject ? item.name : item.company) || '')}
                onChange={(e) =>
                  onChange(
                    patchItem(data, index, isProject ? { name: e.target.value } : { company: e.target.value })
                  )
                }
                placeholder={hints.orgPh}
                variant="borderless"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: neutral[800],
                  padding: '2px 4px',
                  flex: 1,
                  minWidth: 200,
                }}
                aria-label={hints.org}
              />
              <DateRange
                start={item.startDate}
                end={item.endDate}
                current={item.current}
                allowPresent
                onChange={(patch) => onChange(patchItem(data, index, patch))}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
              <Input
                value={String(item.position || item.role || '')}
                onChange={(e) =>
                  onChange(
                    patchItem(
                      data,
                      index,
                      isProject ? { role: e.target.value } : { position: e.target.value }
                    )
                  )
                }
                placeholder={hints.posPh}
                variant="borderless"
                style={{
                  fontSize: 12.5,
                  color: neutral[500],
                  padding: '2px 4px',
                  flex: 1,
                  minWidth: 150,
                }}
                aria-label={hints.pos}
              />
              {isProject && (
                <Input
                  value={String(item.tech || '')}
                  onChange={(e) => onChange(patchItem(data, index, { tech: e.target.value }))}
                  placeholder="技术栈：Spring Boot · PostgreSQL · Redis"
                  variant="borderless"
                  style={{
                    fontSize: 12.5,
                    color: brand.primary,
                    padding: '2px 4px',
                    flex: 1.4,
                    minWidth: 200,
                  }}
                  aria-label="技术栈"
                />
              )}
            </div>

            <BulletsEditor
              item={item}
              itemIndex={index}
              data={data}
              onChange={onChange}
              onOptimize={onOptimize}
              placeholder={
                isProject
                  ? '例：负责简历版本管理模块，用 JSONB 存储动态表单结构，支撑 10 万+ 简历的灵活查询'
                  : '例：主导订单服务重构，将接口 P99 从 800ms 降到 120ms，支撑日均 200 万单'
              }
            />
          </ItemShell>
        ))
      )}

      {items.length > 0 && (
        <button
          onClick={() => onChange(appendItem(data, sectionType))}
          style={{
            width: '100%',
            border: `1px dashed ${neutral[200]}`,
            background: 'transparent',
            color: neutral[500],
            borderRadius: radius.lg,
            padding: '10px 0',
            fontSize: 12.5,
            cursor: 'pointer',
            transition: transition.fast,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = brand.primaryBorder;
            e.currentTarget.style.color = brand.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = neutral[200];
            e.currentTarget.style.color = neutral[500];
          }}
        >
          <PlusOutlined style={{ fontSize: 11, marginRight: 5 }} />
          添加{isProject ? '项目' : '经历'}
        </button>
      )}
    </div>
  );
}

// ==================================================================
// 教育经历
// ==================================================================

function EducationEditor({
  data,
  onChange,
}: {
  data: SectionData;
  onChange: (d: SectionData) => void;
}) {
  const items = readItems(data);

  return (
    <div>
      <BlockHeading
        onAdd={() => onChange(appendItem(data, 'education'))}
        extra={<span style={{ fontSize: 11, color: neutral[400] }}>{items.length} 条记录</span>}
      >
        教育背景（按时间倒序）
      </BlockHeading>

      {items.length === 0 ? (
        <EmptyBlock compact icon="🎓" title="还没有教育经历" description="填写学校、专业、学历与在读时间。" />
      ) : (
        items.map((item, index) => (
          <ItemShell
            key={index}
            index={index}
            total={items.length}
            label={`第 ${index + 1} 条`}
            onMove={(delta) => onChange(moveItem(data, index, delta))}
            onDuplicate={() => onChange(duplicateItem(data, index))}
            onRemove={() => onChange(removeItem(data, index))}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Input
                value={String(item.school || '')}
                onChange={(e) => onChange(patchItem(data, index, { school: e.target.value }))}
                placeholder="学校名称"
                variant="borderless"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: neutral[800],
                  padding: '2px 4px',
                  flex: 1,
                  minWidth: 180,
                }}
              />
              <DateRange
                start={item.startDate}
                end={item.endDate}
                current={item.current}
                allowPresent
                onChange={(patch) => onChange(patchItem(data, index, patch))}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
              <Input
                value={String(item.degree || '')}
                onChange={(e) => onChange(patchItem(data, index, { degree: e.target.value }))}
                placeholder="学历（本科 / 硕士）"
                variant="borderless"
                style={{ fontSize: 12.5, color: neutral[500], padding: '2px 4px', flex: 1, minWidth: 140 }}
              />
              <Input
                value={String(item.major || '')}
                onChange={(e) => onChange(patchItem(data, index, { major: e.target.value }))}
                placeholder="专业"
                variant="borderless"
                style={{ fontSize: 12.5, color: neutral[500], padding: '2px 4px', flex: 1, minWidth: 140 }}
              />
            </div>

            <Input.TextArea
              value={String(item.description || '')}
              onChange={(e) => onChange(patchItem(data, index, { description: e.target.value }))}
              placeholder="可选：GPA、专业排名、主修课程、荣誉（一行一条）"
              autoSize={{ minRows: 1, maxRows: 5 }}
              variant="borderless"
              style={{ fontSize: 12.5, lineHeight: 1.75, marginTop: 6, padding: '4px 6px' }}
            />
          </ItemShell>
        ))
      )}

      {items.length > 0 && (
        <button
          onClick={() => onChange(appendItem(data, 'education'))}
          style={{
            width: '100%',
            border: `1px dashed ${neutral[200]}`,
            background: 'transparent',
            color: neutral[500],
            borderRadius: radius.lg,
            padding: '10px 0',
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          <PlusOutlined style={{ fontSize: 11, marginRight: 5 }} />
          添加教育经历
        </button>
      )}
    </div>
  );
}

// ==================================================================
// 奖项 / 证书
// ==================================================================

function AwardsEditor({
  data,
  onChange,
  sectionType,
}: {
  data: SectionData;
  onChange: (d: SectionData) => void;
  sectionType: SectionType;
}) {
  const items = readItems(data);
  const isAward = sectionType === 'awards';

  return (
    <div>
      <BlockHeading
        onAdd={() => onChange(appendItem(data, sectionType))}
        extra={<span style={{ fontSize: 11, color: neutral[400] }}>{items.length} 条记录</span>}
      >
        {isAward ? '荣誉奖项' : '证书 / 认证'}
      </BlockHeading>

      {items.length === 0 ? (
        <EmptyBlock
          compact
          icon={isAward ? '🥇' : '📜'}
          title={isAward ? '还没有奖项' : '还没有证书'}
          description={
            isAward
              ? '奖学金、竞赛获奖、荣誉称号都可以写，注明级别与时间。'
              : '语言证书、职业资格、技术认证都可以写。'
          }
        />
      ) : (
        items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 10px',
              border: `1px solid ${neutral[150]}`,
              borderRadius: radius.md,
              marginBottom: 7,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: brand.primary,
                flexShrink: 0,
                opacity: 0.6,
              }}
            />
            <Input
              value={String(item.title || item.name || '')}
              onChange={(e) => onChange(patchItem(data, index, { title: e.target.value }))}
              placeholder={isAward ? '奖项名称，如：国家奖学金' : '证书名称，如：CET-6'}
              variant="borderless"
              style={{ flex: 2, fontSize: 13.5, padding: '2px 4px', minWidth: 160 }}
            />
            <Input
              value={String(item.level || '')}
              onChange={(e) => onChange(patchItem(data, index, { level: e.target.value }))}
              placeholder={isAward ? '级别（国家级 / 校级）' : '等级 / 分数'}
              variant="borderless"
              style={{ flex: 1.2, fontSize: 12.5, color: neutral[500], padding: '2px 4px', minWidth: 110 }}
            />
            <Input
              value={String(item.date || '')}
              onChange={(e) => onChange(patchItem(data, index, { date: e.target.value }))}
              placeholder="获得时间"
              variant="borderless"
              style={{ width: 96, fontSize: 12.5, color: neutral[500], padding: '2px 4px' }}
            />
            <button
              onClick={() => onChange(removeItem(data, index))}
              style={{
                border: 'none',
                background: 'transparent',
                color: neutral[300],
                cursor: 'pointer',
                padding: 3,
                display: 'flex',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = semantic.danger;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = neutral[300];
              }}
            >
              <DeleteOutlined />
            </button>
          </div>
        ))
      )}

      {items.length > 0 && (
        <button
          onClick={() => onChange(appendItem(data, sectionType))}
          style={{
            width: '100%',
            border: `1px dashed ${neutral[200]}`,
            background: 'transparent',
            color: neutral[500],
            borderRadius: radius.lg,
            padding: '9px 0',
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          <PlusOutlined style={{ fontSize: 11, marginRight: 5 }} />
          添加{isAward ? '奖项' : '证书'}
        </button>
      )}
    </div>
  );
}

// ==================================================================
// 主组件
// ==================================================================

export default function SectionContentEditor({ sectionType, data, onChange, onOptimize }: Props) {
  const meta = SECTION_META[sectionType];
  const d = normalizeSectionData(data);

  const body = (() => {
    switch (sectionType) {
      case 'basic':
        return <BasicEditor data={d} onChange={onChange} />;
      case 'summary':
      case 'custom':
        return (
          <TextEditor data={d} onChange={onChange} sectionType={sectionType} onOptimize={onOptimize} />
        );
      case 'skills':
        return <SkillsEditor data={d} onChange={onChange} />;
      case 'experience':
      case 'work':
      case 'projects':
        return (
          <ExperienceEditor
            data={d}
            onChange={onChange}
            sectionType={sectionType}
            onOptimize={onOptimize}
          />
        );
      case 'education':
        return <EducationEditor data={d} onChange={onChange} />;
      case 'awards':
      case 'certificates':
        return <AwardsEditor data={d} onChange={onChange} sectionType={sectionType} />;
      default:
        return <TextEditor data={d} onChange={onChange} sectionType={sectionType} onOptimize={onOptimize} />;
    }
  })();

  return (
    <div>
      {/* 顶部提示条：一句话告诉你这个模块该怎么写 */}
      {meta?.hint && sectionType !== 'basic' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 9,
            padding: '10px 13px',
            background: neutral[25],
            border: `1px solid ${neutral[150]}`,
            borderRadius: radius.lg,
            marginBottom: 18,
          }}
        >
          <SectionIcon name={meta.icon} style={{ fontSize: 14, color: brand.primary, marginTop: 2 }} />
          <span style={{ fontSize: 12.5, color: neutral[500], lineHeight: 1.7, flex: 1 }}>
            {meta.hint}
          </span>
        </div>
      )}

      {body}
    </div>
  );
}
