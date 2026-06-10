import { useState, useCallback } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Input, Button, Select, message, Typography, Collapse, Switch, Space, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, BulbOutlined, MenuOutlined } from '@ant-design/icons';
import { resumeApi } from '../../services/api';
import SortableSection from './SortableSection';
import { useResumeStore } from '../../stores/resumeStore';
import type { ResumeSection } from '../../types/resume';

const { Text } = Typography;

const SECTION_LABELS: Record<string, string> = {
  summary: '个人总结',
  experience: '工作经历',
  education: '教育背景',
  projects: '项目经历',
  skills: '专业技能',
  awards: '竞赛获奖',
  certificates: '证书',
};

const SECTION_TYPES = [
  { value: 'summary', label: '个人总结' },
  { value: 'experience', label: '工作经历' },
  { value: 'education', label: '教育背景' },
  { value: 'projects', label: '项目经历' },
  { value: 'skills', label: '专业技能' },
  { value: 'awards', label: '竞赛获奖' },
  { value: 'certificates', label: '证书' },
];

interface Props {
  resumeId: string;
  sections: ResumeSection[];
  onRefresh: () => void;
}

export default function SectionList({ resumeId, sections, onRefresh }: Props) {
  const [addingSection, setAddingSection] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    try {
      await resumeApi.reorderSections(resumeId, reordered.map((s) => ({ id: s.id })));
      onRefresh();
    } catch {
      message.error('排序失败');
    }
  };

  const handleAddSection = async (sectionType: string) => {
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sortOrder), -1);
    try {
      const data: Record<string, unknown> = { sectionType, sortOrder: maxOrder + 1, data: '{}' };
      if (sectionType === 'experience') data.data = JSON.stringify({ company: '', position: '', startDate: '', endDate: '', current: false, bullets: [''] });
      if (sectionType === 'education') data.data = JSON.stringify({ school: '', degree: '', major: '', startDate: '', endDate: '' });
      if (sectionType === 'skills') data.data = JSON.stringify({ items: [''] });
      if (sectionType === 'summary') data.data = JSON.stringify({ content: '' });
      if (sectionType === 'projects') data.data = JSON.stringify({ name: '', role: '', startDate: '', endDate: '', bullets: [''] });
      if (sectionType === 'awards' || sectionType === 'certificates') data.data = JSON.stringify({ items: [] });

      await resumeApi.addSection(resumeId, data as any);
      onRefresh();
      message.success('已添加');
    } catch {
      message.error('添加失败');
    }
    setAddingSection(false);
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await resumeApi.deleteSection(sectionId);
      onRefresh();
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleSectionDataChange = async (sectionId: string, data: any) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    // Update store immediately for real-time preview
    useResumeStore.getState().updateSectionLocal(sectionId, data);
    // Save to API in background
    try {
      await resumeApi.updateSection(sectionId, {
        sectionType: section.sectionType,
        sortOrder: section.sortOrder,
        data: JSON.stringify(data),
      });
    } catch {
      message.error('保存失败');
    }
  };

  const sectionIds = sections.map((s) => s.id);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16 }}>简历章节</Text>
        <Select
          placeholder="+ 添加章节"
          style={{ width: 120 }}
          onChange={handleAddSection}
          options={SECTION_TYPES}
          value={undefined}
          size="small"
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onDelete={() => handleDeleteSection(section.id)}
              onChange={(data) => handleSectionDataChange(section.id, data)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          点击上方"添加章节"开始编辑简历
        </div>
      )}
    </div>
  );
}
