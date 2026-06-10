import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Navbar from './components/common/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import AuthGuard from './components/common/AuthGuard';

const { Content } = Layout;

export default function App() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <Content>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/editor/:id" element={<AuthGuard><Editor /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
    </Layout>
  );
}
