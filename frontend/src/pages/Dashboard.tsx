import { useEffect, useState } from 'react';
import { useResumeStore } from '../stores/resumeStore';
import {
  Layout, Card, Button, Row, Col, Typography, Modal, Input, message, Spin, Empty, Popconfirm,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header, Content } = Layout;
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
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8e8e8' }}>
        <Title level={4} style={{ margin: 0 }}>📄 简历助手</Title>
        <Text type="secondary" style={{ cursor: 'pointer' }} onClick={() => {
          localStorage.removeItem('token');
          navigate('/login');
        }}>退出</Text>
      </Header>
      <Content style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>我的简历</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} size="large">
            新建简历
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : resumes.length === 0 ? (
          <Empty description="还没有简历，点击上方按钮创建" style={{ padding: 80 }} />
        ) : (
          <Row gutter={[20, 20]}>
            {resumes.map((r) => (
              <Col xs={24} sm={12} md={8} lg={6} key={r.id}>
                <Card
                  hoverable
                  actions={[
                    <EditOutlined key="edit" onClick={() => navigate(`/editor/${r.id}`)} />,
                    <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} key="delete">
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 28, color: '#2563eb' }} />}
                    title={r.title}
                    description={
                      <div>
                        <div>更新于 {formatDate(r.updatedAt)}</div>
                        {r.targetJob && <Text type="secondary">目标岗位：{r.targetJob}</Text>}
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Content>

      <Modal
        title="新建简历"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); setNewTitle(''); }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入简历名称"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={handleCreate}
          autoFocus
        />
      </Modal>
    </Layout>
  );
}
