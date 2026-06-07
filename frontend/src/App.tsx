import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import AuthGuard from './components/common/AuthGuard';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/editor/:id" element={<AuthGuard><Editor /></AuthGuard>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
