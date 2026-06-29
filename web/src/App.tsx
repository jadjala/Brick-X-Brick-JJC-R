import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './routes/require-auth';
import { LoginPage } from './pages/login';
import { AttendanceDashboardPage } from './pages/attendance-dashboard';
import { AttendanceDetailsPage } from './pages/attendance-details';
import { NotFoundPage } from './pages/not-found';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/attendance" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/attendance" element={<AttendanceDashboardPage />} />
        <Route path="/attendance/:id" element={<AttendanceDetailsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
