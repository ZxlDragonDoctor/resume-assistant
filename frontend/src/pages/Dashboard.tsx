import { useEffect, useState } from 'react';
import { useResumeStore } from '../stores/resumeStore';
import {
  Card, Button, Row, Col, Typography, Modal, Input, message, Spin, Empty, Popconfirm,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const { resumes, loading, fetchResumes, createResume, deleteResume } = useResumeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => { fetchResumes(); }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createResume(newTitle.trim());
    setModalOpen(false);
    setNewTitle('');
    message.success('简历创建成功');
  };

  const handleDelete = async (id: string) => {
    await deleteResume(id);
    message.success('删除成功');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>我的简历</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>共 {resumes.length} 份简历</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
          style={{ height: 40, borderRadius: 10, padding: '0 20px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none' }}
        >
          新建简历
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : resumes.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 80, background: '#fff', borderRadius: 16,
          border: '2px dashed #e2e8f0',
        }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#94a3b8', marginBottom: 16 }} />
          <div style={{ fontSize: 16, color: '#64748b', marginBottom: 8 }}>还没有简历</div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>点击上方按钮创建你的第一份简历</Text>
          <Button type="primary" onClick={() => setModalOpen(true)}>创建简历</Button>
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {resumes.map((r) => (
            <Col xs={24} sm={12} md={8} lg={6} key={r.id}>
              <Card
                hoverable
                style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}
                bodyStyle={{ padding: 20 }}
                actions={[
                  <EditOutlined key="edit" onClick={() => navigate(`/editor/${r.id}`)} style={{ color: '#2563eb' }} />,
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} key="delete">
                    <DeleteOutlined style={{ color: '#ff4d4f' }} />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 28, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} />}
                  title={<span style={{ fontSize: 15, fontWeight: 500 }}>{r.title}</span>}
                  description={
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      <div>更新于 {formatDate(r.updatedAt)}</div>
                      {r.targetJob && <div style={{ marginTop: 4, color: '#64748b' }}>目标：{r.targetJob}</div>}
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建简历"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); setNewTitle(''); }}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Input
          placeholder="请输入简历名称"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={handleCreate}
          autoFocus
          style={{ borderRadius: 8 }}
        />
      </Modal>
    </div>
  );
}
