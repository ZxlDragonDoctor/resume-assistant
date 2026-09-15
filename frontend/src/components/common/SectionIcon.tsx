/**
 * 模块图标映射
 * ------------------------------------------------------------------
 * 把 constants/sections 里的字符串图标名映射为 antd 图标组件，
 * 保持常量文件无框架依赖，便于在纯逻辑层复用。
 */
import {
  UserOutlined,
  MessageOutlined,
  BankOutlined,
  CodeOutlined,
  ReadOutlined,
  ToolOutlined,
  TrophyOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { ComponentType, CSSProperties } from 'react';

const ICON_MAP: Record<string, ComponentType<{ style?: CSSProperties }>> = {
  user: UserOutlined,
  quote: MessageOutlined,
  briefcase: BankOutlined,
  code: CodeOutlined,
  school: ReadOutlined,
  tool: ToolOutlined,
  trophy: TrophyOutlined,
  certificate: SafetyCertificateOutlined,
  file: FileTextOutlined,
  folder: FolderOutlined,
};

export function SectionIcon({
  name,
  style,
}: {
  name: string;
  style?: CSSProperties;
}) {
  const Icon = ICON_MAP[name] ?? FileTextOutlined;
  return <Icon style={style} />;
}

export default SectionIcon;
