import { FormEvent, MouseEvent, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { z } from 'zod';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import type { ProjectRes, TaskRes } from '../types';

dayjs.extend(relativeTime);

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(160, 'Name must be 160 characters or fewer'),
  description: z
    .string()
    .max(10000, 'Description must be 10,000 characters or fewer')
    .optional(),
});

type FormState = {
  name: string;
  description: string;
};

const initialState: FormState = {
  name: '',
  description: '',
};

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(160, 'Title must be 160 characters or fewer'),
  description: z.string().max(10000, 'Description must be 10,000 characters or fewer').optional(),
  endAt: z.string().min(1, 'Due date is required'),
  isActivity: z.boolean().optional(),
});

type TaskFormState = {
  title: string;
  description: string;
  endAt: string;
  isActivity: boolean;
};

const taskInitialState: TaskFormState = {
  title: '',
  description: '',
  endAt: '',
  isActivity: false,
};

export default function ProjectsPage() {
  const { data, isLoading, isError, error, createProject, creating } = useProjects();
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectRes | null>(null);
  const {
    data: taskData,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
    createTask,
    creating: creatingTask,
    deleteTask,
    deleting: deletingTask,
    updateTask,
    updating: updatingTask,
  } = useTasks(selectedProject?.id);
  const [taskForm, setTaskForm] = useState<TaskFormState>(taskInitialState);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const projects = data?.content ?? [];
  const tasks = taskData?.content ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const result = projectSchema.safeParse({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    });

    if (!result.success) {
      const first = result.error.issues.at(0);
      setFormError(first?.message ?? 'Invalid input');
      return;
    }

    try {
      await createProject(result.data);
      setForm(initialState);
    } catch (mutationError) {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Failed to create project');
    }
  };

  const handleProjectClick = (event: MouseEvent<HTMLButtonElement>, project: ProjectRes) => {
    event.preventDefault();
    setSelectedProject(project);
  };

  const closeModal = () => {
    setSelectedProject(null);
  };

  useEffect(() => {
    setTaskForm(taskInitialState);
    setTaskFormError(null);
    setEditingTaskId(null);
    setDeletingTaskId(null);
  }, [selectedProject?.id]);

  const handleTaskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProject) {
      return;
    }

    setTaskFormError(null);

    const result = taskSchema.safeParse({
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      endAt: taskForm.endAt,
      isActivity: taskForm.isActivity,
    });

    if (!result.success) {
      const first = result.error.issues.at(0);
      setTaskFormError(first?.message ?? 'Invalid input');
      return;
    }

    const dueDate = dayjs(result.data.endAt);
    if (!dueDate.isValid()) {
      setTaskFormError('Provide a valid due date');
      return;
    }

    try {
      if (editingTaskId) {
        await updateTask(editingTaskId, {
          projectId: selectedProject.id,
          ...result.data,
          endAt: dueDate.toISOString(),
        });
      } else {
        await createTask({
          projectId: selectedProject.id,
          ...result.data,
          endAt: dueDate.toISOString(),
        });
      }
      setTaskForm(taskInitialState);
      setEditingTaskId(null);
    } catch (mutationError) {
      setTaskFormError(
        mutationError instanceof Error
          ? mutationError.message
          : editingTaskId
            ? 'Failed to update task'
            : 'Failed to create task'
      );
    }
  };

  const handleStartTaskEdit = (task: TaskRes) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description ?? '',
      endAt: dayjs(task.endAt).isValid() ? dayjs(task.endAt).local().format('YYYY-MM-DDTHH:mm') : '',
      isActivity: Boolean(task.isActivity),
    });
    setTaskFormError(null);
  };

  const handleCancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskForm(taskInitialState);
    setTaskFormError(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    setTaskFormError(null);
    setDeletingTaskId(taskId);
    try {
      await deleteTask(taskId);
      if (editingTaskId === taskId) {
        handleCancelTaskEdit();
      }
    } catch (mutationError) {
      setTaskFormError(
        mutationError instanceof Error ? mutationError.message : 'Failed to delete task'
      );
    } finally {
      setDeletingTaskId(null);
    }
  };

  const isTaskSubmitting = creatingTask || updatingTask;
  const taskSubmitLabel = editingTaskId
    ? updatingTask
      ? 'Updating…'
      : 'Update task'
    : creatingTask
      ? 'Creating…'
      : 'Add task';


  return (
    <div className="card">
      <h2>Projects</h2>
      <p>Projects collect tasks and notes. Create a project to get started.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="project-name">Name</label>
          <input
            id="project-name"
            name="name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Summer roadmap"
            required
            maxLength={160}
          />
        </div>
        <div className="field">
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            name="description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="What are we delivering?"
            maxLength={10000}
            rows={3}
          />
        </div>
        {formError ? <p className="error-message">{formError}</p> : null}
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create project'}
        </button>
      </form>

      <section>
        <h3>Recent projects</h3>
        {isLoading ? <p>Loading projects…</p> : null}
        {isError ? <p className="error-message">{error instanceof Error ? error.message : 'Failed to load projects'}</p> : null}
        {!isLoading && !projects.length ? <p>No projects yet.</p> : null}
        <ul className="list">
          {projects.map((project) => (
            <li key={project.id} className="list-item">
              <button type="button" className="list-item-button" onClick={(event) => handleProjectClick(event, project)}>
                <strong>{project.name}</strong>
                {project.description ? <p>{project.description}</p> : null}
                <p className="badge">Updated {dayjs(project.updatedAt).fromNow()}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedProject ? (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="project-modal-title">{selectedProject.name}</h3>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close project tasks">
                ×
              </button>
            </div>
            {selectedProject.description ? <p>{selectedProject.description}</p> : null}
            <section>
              <h4>Tasks</h4>
              <form onSubmit={handleTaskSubmit} noValidate className="modal-task-form">
                <div className="field">
                  <label htmlFor="task-title-modal">Title</label>
                  <input
                    id="task-title-modal"
                    name="title"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Prep release notes"
                    maxLength={160}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-description-modal">Description</label>
                  <textarea
                    id="task-description-modal"
                    name="description"
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Add more details"
                    rows={3}
                    maxLength={10000}
                  />
                </div>
                <div className="field">
                  <label htmlFor="task-end-modal">Due</label>
                  <input
                    id="task-end-modal"
                    name="endAt"
                    type="datetime-local"
                    value={taskForm.endAt}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        endAt: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={taskForm.isActivity}
                      onChange={(event) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          isActivity: event.target.checked,
                        }))
                      }
                    />{' '}
                    Activity task
                  </label>
                </div>
                {taskFormError ? <p className="error-message">{taskFormError}</p> : null}
                <div className="task-form-actions">
                  <button type="submit" disabled={isTaskSubmitting}>
                    {taskSubmitLabel}
                  </button>
                  {editingTaskId ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={handleCancelTaskEdit}
                      disabled={isTaskSubmitting}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
              {tasksLoading ? <p>Loading tasks…</p> : null}
              {tasksError ? (
                <p className="error-message">
                  {tasksErrorObj instanceof Error ? tasksErrorObj.message : 'Failed to load tasks'}
                </p>
              ) : null}
              {!tasksLoading && !tasksError && !tasks.length ? <p>No tasks yet.</p> : null}
              <ul className="list">
                {tasks.map((task) => (
                  <li key={task.id} className="list-item">
                    <strong>{task.title}</strong>
                    {task.description ? <p>{task.description}</p> : null}
                    <p className="badge">Due {dayjs(task.endAt).format('MMM D, YYYY h:mm A')}</p>
                    <div className="list-item-actions">
                      <button type="button" className="button-secondary" onClick={() => handleStartTaskEdit(task)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => void handleDeleteTask(task.id)}
                        disabled={deletingTask}
                      >
                        {deletingTask && deletingTaskId === task.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
