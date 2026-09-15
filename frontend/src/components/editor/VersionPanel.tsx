/**
 * 版本历史面板
 * ------------------------------------------------------------------
 * 简历写作是「反复推翻重来」的过程，版本功能是安全网：
 * 每次大改前存一版，改坏了随时回退。
 *
 * 交互：右侧抽屉展示时间线，支持手动存档、预览差异（内容摘要）、回退、删除。
 */
import { useState } from 'react';
import { Button, Empty, Input, Modal, Spin, Tag } from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  HistoryOutlined,
  PlusOutlined,
  RollbackOutlined,
} from '@ant-design/icons';

import type { ResumeVersion } from '../../types/resume';
import { message, modal } from '../../utils/antdStatic';
import { brand, neutral, radius, semantic, transition } from '../../styles/tokens';

interface Props {
  versions: ResumeVersion[];
  loading?: boolean;
  saving?: boolean;
  onCreate: (label: string, description?: string) => Promise<void>;
  onRestore: (versionId: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return d.toLocaleDateString('zh-CN');
}

export default function VersionPanel({
  versions,
  loading,
  saving,
  onCreate,
  onRestore,
  onDelete,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    const name = label.trim() || `版本 ${versions.length + 1}`;
    setSubmitting(true);
    try {
      await onCreate(name, description.trim() || undefined);
      message.success('已保存为新版本');
      setModalOpen(false);
      setLabel('');
      setDescription('');
    } catch {
      message.error('保存版本失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: `1px solid ${neutral[150]}`,
          flexShrink: 0,
        }}
      >
        <HistoryOutlined style={{ color: brand.primary, fontSize: 14 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: neutral[800], flex: 1 }}>
          版本历史
        </span>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          loading={saving}
          onClick={() => setModalOpen(true)}
          style={{ background: brand.gradient, border: 'none', fontSize: 12 }}
        >
          存档
        </Button>
      </div>

      {/* 列表 */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 12.5, color: neutral[400], lineHeight: 1.8 }}>
                还没有版本记录
                <br />
                大改之前点「存档」，随时可以回退
              </span>
            }
            style={{ marginTop: 40 }}
          />
        ) : (
          <div style={{ position: 'relative', paddingLeft: 18 }}>
            {/* 时间轴 */}
            <div
              style={{
                position: 'absolute',
                left: 5,
                top: 6,
                bottom: 6,
                width: 1,
                background: neutral[150],
              }}
            />

            {versions.map((v, i) => (
              <div key={v.id} style={{ position: 'relative', marginBottom: 14 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: -18,
                    top: 4,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: i === 0 ? brand.primary : '#fff',
                    border: `2px solid ${i === 0 ? brand.primary : neutral[300]}`,
                    boxSizing: 'content-box',
                  }}
                />

                <div
                  style={{
                    border: `1px solid ${i === 0 ? brand.primaryBorder : neutral[150]}`,
                    background: i === 0 ? brand.primarySoft : '#fff',
                    borderRadius: radius.lg,
                    padding: '10px 12px',
                    transition: transition.fast,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <Tag
                      style={{
                        fontSize: 10,
                        lineHeight: '15px',
                        margin: 0,
                        borderRadius: radius.xs,
                        background: i === 0 ? brand.primary : neutral[100],
                        color: i === 0 ? '#fff' : neutral[500],
                        border: 'none',
                      }}
                    >
                      v{v.versionNum}
                    </Tag>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: neutral[800],
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.label}
                    </span>
                  </div>

                  {v.description && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: neutral[500],
                        lineHeight: 1.7,
                        marginBottom: 6,
                      }}
                    >
                      {v.description}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: neutral[400],
                    }}
                  >
                    <ClockCircleOutlined style={{ fontSize: 10 }} />
                    <span>{formatTime(v.createdAt)}</span>
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        modal.confirm({
                          title: `回退到「${v.label}」？`,
                          content: '当前内容会被该版本覆盖，建议先存档当前状态。',
                          okText: '确认回退',
                          cancelText: '取消',
                          okButtonProps: { danger: true },
                          onOk: async () => {
                            try {
                              await onRestore(v.id);
                              message.success('已回退到该版本');
                            } catch {
                              message.error('回退失败');
                            }
                          },
                        });
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: brand.primary,
                        fontSize: 11.5,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '2px 5px',
                        borderRadius: radius.xs,
                      }}
                    >
                      <RollbackOutlined style={{ fontSize: 10.5 }} /> 回退
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await onDelete(v.id);
                          message.success('已删除该版本');
                        } catch {
                          message.error('删除失败');
                        }
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: neutral[400],
                        fontSize: 11.5,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        display: 'inline-flex',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = semantic.danger;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = neutral[400];
                      }}
                    >
                      <DeleteOutlined style={{ fontSize: 10.5 }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 存档弹窗 */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        title="保存为新版本"
        okText="保存"
        cancelText="取消"
        confirmLoading={submitting}
        width={420}
        okButtonProps={{ style: { background: brand.gradient, border: 'none' } }}
      >
        <div style={{ paddingTop: 6 }}>
          <div style={{ fontSize: 12.5, color: neutral[600], marginBottom: 6 }}>版本名称</div>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`版本 ${versions.length + 1}`}
            maxLength={40}
            onPressEnter={handleCreate}
          />
          <div style={{ fontSize: 12.5, color: neutral[600], margin: '14px 0 6px' }}>
            备注（可选）
          </div>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：投递字节跳动前的定稿版本"
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={120}
          />
        </div>
      </Modal>
    </div>
  );
}
