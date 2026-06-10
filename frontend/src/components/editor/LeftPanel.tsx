import { Typography } from 'antd';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuOutlined } from '@ant-design/icons';
import type { ResumeSection } from '../../types/resume';

const { Text } = Typography;

const MODULE_CONFIG: Record<string, { label: string; icon: string }> = {
  basic: { label: '基本信息', icon: '👤' },
  education: { label: '教育经历', icon: '🎓' },
  awards: { label: '荣誉奖项和证书', icon: '🏆' },
  skills: { label: '专业技能', icon: '💻' },
  experience: { label: '实习经历', icon: '💼' },
  projects: { label: '项目经历', icon: '📂' },
  summary: { label: '个人总结', icon: '📝' },
  certificates: { label: '证书', icon: '📜' },
  custom: { label: '自定义模块', icon: '📦' },
};

interface Props {
  sections: ResumeSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

const ADDABLE_TYPES = [
  { value: 'basic', label: '基本信息' },
  { value: 'education', label: '教育经历' },
  { value: 'awards', label: '荣誉奖项' },
  { value: 'skills', label: '专业技能' },
  { value: 'experience', label: '实习经历' },
  { value: 'projects', label: '项目经历' },
  { value: 'summary', label: '个人总结' },
  { value: 'custom', label: '自定义模块' },
];

function SortableItem({ section, isSelected, onSelect }: {
  section: ResumeSection;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const cfg = MODULE_CONFIG[section.sectionType] || { label: section.sectionType, icon: '📄' };
  // Check for custom module name in section data
  let customName = '';
  try {
    const data = typeof section.data === 'string' ? JSON.parse(section.data) : section.data || {};
    if (data._config && data._config.moduleName) customName = data._config.moduleName;
  } catch {}

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(section.id)}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f1f5f9'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 8px 8px', cursor: 'pointer',
        background: isSelected ? '#eef2ff' : 'transparent',
        borderRight: isSelected ? '3px solid #2563eb' : '3px solid transparent',
        transition: transition || 'all 0.15s',
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
      }}
    >
      <span {...attributes} {...listeners} style={{ cursor: 'grab', fontSize: 14, color: '#94a3b8', display: 'flex' }}>
        <MenuOutlined />
      </span>
      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
      <Text style={{
        fontSize: 13, flex: 1,
        color: isSelected ? '#1e40af' : '#475569',
        fontWeight: isSelected ? 500 : 400,
      }}>
        {customName || cfg.label}
      </Text>
    </div>
  );
}

export default function LeftPanel({ sections, selectedId, onSelect, onAdd, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(reordered.map(s => s.id));
  };

  const hasType = (type: string) => sections.some(s => s.sectionType === type);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid #e8e8e8' }}>
        <Text strong style={{ fontSize: 14, color: '#334155' }}>简历模块</Text>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SortableItem
                key={section.id}
                section={section}
                isSelected={section.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid #e8e8e8' }}>
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) onAdd(e.target.value); e.target.value = ''; }}
          style={{
            width: '100%', padding: '6px 10px', borderRadius: 6,
            border: '1px solid #d9d9d9', fontSize: 13, color: '#475569',
            background: '#fff', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="" disabled>+ 添加模块</option>
          {ADDABLE_TYPES.filter(t => !hasType(t.value)).map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
