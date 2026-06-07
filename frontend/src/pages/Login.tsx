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
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0 }}>📄 简历助手</Title>
          <Text type="secondary">{isRegister ? '创建新账号' : '登录继续'}</Text>
        </div>

        <Form onFinish={handleSubmit} layout="vertical" size="large">
          {isRegister && (
            <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input prefix={<UserOutlined />} placeholder="姓名" />
            </Form.Item>
          )}
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {isRegister ? '注册' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Button type="link" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
