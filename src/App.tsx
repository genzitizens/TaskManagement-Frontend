import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import MenuPage from './routes/MenuPage';
import ProjectDetailPage from './routes/ProjectDetailPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <MenuPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
