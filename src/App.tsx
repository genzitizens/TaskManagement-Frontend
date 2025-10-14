import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import MenuPage from './routes/MenuPage';
import TasksPage from './routes/TasksPage';
import ProjectDetailPage from './routes/ProjectDetailPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <MenuPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
