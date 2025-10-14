import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import TaskModal from '../components/TaskModal';
import type { TaskWithNoteInput } from '../types';

export default function TasksPage() {
  const { data: projectData, isLoading: projectsLoading, isError: projectsError, error: projectsErrorData } =
    useProjects();
  const projects = projectData?.content ?? [];

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('projectId') ?? '';
  const modalParam = searchParams.get('modal');
  const isModalOpen = modalParam === 'create';

  const tasksHook = useTasks(selectedProjectId || undefined);
  const { data, isLoading, isError, error, createTask, creating, deleteTask, deleting } = tasksHook;

  const tasks = data?.content ?? [];

  const handleProjectChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('projectId', value);
    } else {
      next.delete('projectId');
    }
    setSearchParams(next, { replace: true });
  };

  const openModal = () => {
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'create');
    if (selectedProjectId) {
      next.set('projectId', selectedProjectId);
    }
    setSearchParams(next, { replace: true });
  };

  const closeModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('modal');
    setSearchParams(next, { replace: true });
  };

  const handleCreateTask = async (input: TaskWithNoteInput) => {
    await createTask(input);
  };

  return (
    <div className="card tasks-page">
      <div className="tasks-page__header">
        <div>
          <h2>Tasks</h2>
          <p className="tasks-page__subtitle">
            Tasks keep work scoped to a single project. Select a project to view tasks and add new ones.
          </p>
        </div>
        <button type="button" onClick={openModal} disabled={!projects.length}>
          Add Task
        </button>
      </div>

      <div className="field">
        <label htmlFor="tasks-page-project">Project</label>
        <select
          id="tasks-page-project"
          value={selectedProjectId}
          onChange={(event) => handleProjectChange(event.target.value)}
          disabled={!projects.length}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {projectsLoading ? <p>Loading projects…</p> : null}
      {projectsError ? (
        <p className="error-message">
          {projectsErrorData instanceof Error ? projectsErrorData.message : 'Failed to load projects'}
        </p>
      ) : null}

      <section>
        <h3>Upcoming tasks</h3>
        {!selectedProjectId ? <p>Select a project to load tasks.</p> : null}
        {selectedProjectId && isLoading ? <p>Loading tasks…</p> : null}
        {selectedProjectId && isError ? (
          <p className="error-message">{error instanceof Error ? error.message : 'Failed to load tasks'}</p>
        ) : null}
        {selectedProjectId && !isLoading && !tasks.length ? <p>No tasks yet.</p> : null}
        <ul className="list">
          {tasks.map((task) => (
            <li key={task.id} className="list-item">
              <strong>{task.title}</strong>
              {task.description ? <p>{task.description}</p> : null}
              {task.note?.body ? <p className="list-item__note">Note: {task.note.body}</p> : null}
              <p className="badge">Due {dayjs(task.endAt).format('MMM D, YYYY h:mm A')}</p>
              <button
                type="button"
                onClick={() => void deleteTask(task.id)}
                disabled={deleting}
                style={{ marginTop: '0.75rem', background: '#dc2626' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <TaskModal
        isOpen={isModalOpen}
        projects={projects}
        defaultProjectId={selectedProjectId || undefined}
        submitting={creating}
        onSubmit={handleCreateTask}
        onClose={closeModal}
      />
    </div>
  );
}
