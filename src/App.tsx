import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import ProjectsPage from './routes/ProjectsPage';
import TasksPage from './routes/TasksPage';
import NotesPage from './routes/NotesPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <ProjectsPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'notes', element: <NotesPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
