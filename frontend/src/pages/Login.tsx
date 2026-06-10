import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      let res: any;
      if (isRegister) {
        res = await authApi.register(values.email, values.password, values.name);
      } else {
        res = await authApi.login(values.email, values.password);
      }
      const { token } = res.data;
      localStorage.setItem('token', token);
      message.success(isRegister ? '注册成功' : '登录成功');
      navigate('/dashboard');
    } catch (err: any) {
      message.error(err.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)',
      padding: 24,
    }}>
      <Card style={{
        width: 420, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
      }} bodyStyle={{ padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{
            margin: 0, marginBottom: 8,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            晓龙简历
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {isRegister ? '创建账号，开始制作简历' : '登录继续制作简历'}
          </Text>
        </div>

        <Form onFinish={handleSubmit} layout="vertical" size="large">
          {isRegister && (
            <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input prefix={<UserOutlined />} placeholder="姓名" style={{ borderRadius: 10 }} />
            </Form.Item>
          )}
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ borderRadius: 10 }} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none' }}
            >
              {isRegister ? '注册' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Button type="link" onClick={() => setIsRegister(!isRegister)} style={{ color: '#64748b' }}>
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
