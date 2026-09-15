/**
 * 编辑器左栏：模块管理
 * ------------------------------------------------------------------
 * 功能：
 *   - 模块列表（拖拽排序、点击选中、显示/隐藏、复制、删除）
 *   - 新增模块（按分组展开的菜单）
 *   - 顶部简历信息摘要
 *
 * 交互细节：拖拽手柄只在悬浮时出现，避免视觉噪音；
 * 隐藏的模块以半透明呈现，仍可点击编辑。
 */
import { useMemo, useState } from 'react';
import { Dropdown, Tooltip, type MenuProps } from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import SectionIcon from '../common/SectionIcon';
import { SECTION_GROUPS, SECTION_META, SECTION_LIST } from '../../constants/sections';
import { normalizeSectionData, type ResumeSection, type SectionType } from '../../types/resume';
import { brand, neutral, radius, transition } from '../../styles/tokens';

interface Props {
  sections: ResumeSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: SectionType) => void;
  onReorder: (orderedIds: string[]) => void;
  onToggleVisible: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onJumpToBasic: () => void;
}

// ==================================================================
// 单个可排序模块
// ==================================================================

function SortableSection({
  section,
  active,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onDelete,
}: {
  section: ResumeSection;
  active: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const meta = SECTION_META[section.sectionType];
  const data = normalizeSectionData(section.data);
  const customName = (data._config as { moduleName?: string } | undefined)?.moduleName;
  const label = customName || meta?.label || section.sectionType;
  const hidden = section.isVisible === false;

  const menu: MenuProps['items'] = [
    {
      key: 'toggle',
      icon: hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />,
      label: hidden ? '在简历中显示' : '在简历中隐藏',
      onClick: onToggleVisible,
    },
    {
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: '复制此模块',
      onClick: onDuplicate,
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: onDelete,
    },
  ];

  return (
    <div
      ref={setNodeRef}
      className={`section-item${active ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 8px 7px 4px',
        margin: '1px 6px',
        borderRadius: radius.md,
        cursor: 'pointer',
        borderRight: `3px solid ${active ? brand.primary : 'transparent'}`,
        opacity: hidden ? 0.5 : isDragging ? 0.45 : 1,
        transform: CSS.Transform.toString(transform),
        transition: transition ? undefined : undefined,
        position: 'relative',
        zIndex: isDragging ? 10 : 1,
      }}
    >
      {/* 拖拽手柄 */}
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={{
          cursor: 'grab',
          color: neutral[300],
          fontSize: 12,
          display: 'flex',
          padding: 2,
          flexShrink: 0,
        }}
      >
        <HolderOutlined />
      </span>

      {/* 图标 */}
      <SectionIcon
        name={meta?.icon ?? 'file'}
        style={{ fontSize: 14, color: active ? brand.primary : neutral[400], flexShrink: 0 }}
      />

      {/* 名称 */}
      <span
        className="section-item-label"
        style={{
          flex: 1,
          fontSize: 13,
          color: active ? brand.primaryActive : neutral[600],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>

      {/* 悬浮工具 */}
      <span
        className="section-toolbar"
        style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title={hidden ? '显示' : '隐藏'} mouseEnterDelay={0.4}>
          <button
            onClick={onToggleVisible}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 3,
              color: neutral[400],
              fontSize: 12,
              display: 'flex',
              borderRadius: radius.xs,
            }}
          >
            {hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>
        </Tooltip>

        <Dropdown menu={{ items: menu }} trigger={['click']} placement="bottomRight">
          <button
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '3px 5px',
              color: neutral[400],
              fontSize: 14,
              lineHeight: 1,
              borderRadius: radius.xs,
            }}
          >
            ⋯
          </button>
        </Dropdown>
      </span>
    </div>
  );
}

// ==================================================================
// 左栏主体
// ==================================================================

export default function SectionSidebar({
  sections,
  selectedId,
  onSelect,
  onAdd,
  onReorder,
  onToggleVisible,
  onDuplicate,
  onDelete,
  onJumpToBasic,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.sortOrder - b.sortOrder),
    [sections]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((s) => s.id === active.id);
    const newIndex = ordered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = [...ordered];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next.map((s) => s.id));
  };

  const existingTypes = new Set(sections.map((s) => s.sectionType));

  /** 构建新增模块菜单：已存在且不可重复的模块置灰 */
  const menuItems: MenuProps['items'] = SECTION_GROUPS.map((group) => ({
    key: group.title,
    type: 'group' as const,
    label: (
      <div
        style={{
          fontSize: 11,
          color: neutral[400],
          fontWeight: 600,
          letterSpacing: 0.5,
          padding: '4px 0 2px',
        }}
      >
        {group.title}
      </div>
    ),
    children: group.types.map((type) => {
      const meta = SECTION_META[type];
      const exists = existingTypes.has(type);
      return {
        key: type,
        icon: <SectionIcon name={meta.icon} style={{ fontSize: 13 }} />,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{meta.label}</span>
            {exists && (
              <span style={{ fontSize: 10.5, color: neutral[400], marginLeft: 12 }}>已添加</span>
            )}
          </span>
        ),
        onClick: () => onAdd(type),
      };
    }),
  }));

  const basicSection = ordered.find((s) => s.sectionType === 'basic');
  const otherSections = ordered.filter((s) => s.sectionType !== 'basic');

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRight: `1px solid ${neutral[150]}`,
      }}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '12px 14px 10px',
          borderBottom: `1px solid ${neutral[150]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: neutral[700], letterSpacing: 0.3 }}>
          简历模块
        </span>
        <span style={{ fontSize: 11, color: neutral[400] }}>{sections.length} 个</span>
      </div>

      {/* 模块列表 */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {/* 基本信息固定在最上方（它是特殊模块，不参与排序语义） */}
        {basicSection && (
          <SortableSection
            section={basicSection}
            active={basicSection.id === selectedId}
            onSelect={() => onSelect(basicSection.id)}
            onToggleVisible={() => onToggleVisible(basicSection.id)}
            onDuplicate={() => onDuplicate(basicSection.id)}
            onDelete={() => onDelete(basicSection.id)}
          />
        )}

        {/* 分隔 */}
        {basicSection && otherSections.length > 0 && (
          <div
            style={{
              height: 1,
              background: neutral[150],
              margin: '6px 12px',
            }}
          />
        )}

        {/* 其余模块可拖拽 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={otherSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {otherSections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                active={section.id === selectedId}
                onSelect={() => onSelect(section.id)}
                onToggleVisible={() => onToggleVisible(section.id)}
                onDuplicate={() => onDuplicate(section.id)}
                onDelete={() => onDelete(section.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* 空状态 */}
        {ordered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              fontSize: 12.5,
              color: neutral[400],
              lineHeight: 1.8,
            }}
          >
            还没有模块
            <br />
            点击下方按钮开始添加
          </div>
        )}

        {/* 快捷入口 */}
        {basicSection && (
          <button
            onClick={onJumpToBasic}
            style={{
              margin: '8px 12px 4px',
              width: 'calc(100% - 24px)',
              padding: '6px 10px',
              border: `1px dashed ${neutral[200]}`,
              background: 'transparent',
              borderRadius: radius.md,
              fontSize: 12,
              color: neutral[500],
              cursor: 'pointer',
            }}
          >
            回到基本信息
          </button>
        )}
      </div>

      {/* 新增模块 */}
      <div style={{ padding: 12, borderTop: `1px solid ${neutral[150]}` }}>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={['click']}
          placement="topLeft"
          open={addOpen}
          onOpenChange={setAddOpen}
          popupRender={(menu) => (
            <div
              style={{
                background: '#fff',
                borderRadius: radius.lg,
                boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
                border: `1px solid ${neutral[150]}`,
                padding: '6px 0',
                maxHeight: 420,
                overflowY: 'auto',
              }}
            >
              {menu}
            </div>
          )}
        >
          <button
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 12px',
              borderRadius: radius.md,
              border: `1px solid ${brand.primaryBorder}`,
              background: addOpen ? brand.primarySoft : '#fff',
              color: brand.primary,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.14s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = brand.primarySoft;
              e.currentTarget.style.borderColor = brand.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = addOpen ? brand.primarySoft : '#fff';
              e.currentTarget.style.borderColor = brand.primaryBorder;
            }}
          >
            <PlusOutlined style={{ fontSize: 12 }} />
            添加模块
          </button>
        </Dropdown>
      </div>
    </div>
  );
}
