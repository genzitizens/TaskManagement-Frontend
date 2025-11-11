import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './routes/LoginPage';
import MenuPage from './routes/MenuPage';
import ProjectDetailPage from './routes/ProjectDetailPage';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <MenuPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
