import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useTasks } from '../hooks/useTasks';
import TaskModal from '../components/TaskModal';
import ConfirmDialog from '../components/ConfirmDialog';
import type { TaskCreateInput } from '../types';

const MINIMUM_DAY_COLUMNS = 100;
const MOBILE_COLUMN_COUNT = 20;
const TABLET_COLUMN_COUNT = 24;
const DESKTOP_COLUMN_COUNT = 30;

const DESKTOP_BREAKPOINT = 1440;
const TABLET_BREAKPOINT = 1024;

function getVisibleColumnCount(width: number) {
  if (width >= DESKTOP_BREAKPOINT) {
    return DESKTOP_COLUMN_COUNT;
  }
  if (width >= TABLET_BREAKPOINT) {
    return TABLET_COLUMN_COUNT;
  }
  return MOBILE_COLUMN_COUNT;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const modalParam = searchParams.get('modal');
  const taskIdParam = searchParams.get('task');
  const isCreateModalOpen = modalParam === 'create';
  const editingTaskId = modalParam === 'edit' ? taskIdParam : null;
  const isEditModalOpen = Boolean(editingTaskId);
  const isModalOpen = isCreateModalOpen || isEditModalOpen;

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErrorData,
  } = useProject(projectId);

  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorData,
    createTask,
    creating,
    deleteTask,
    deleting,
    updateTask,
    updating,
  } = useTasks(projectId);

  const tasks = tasksData?.content ?? [];
  const editingTask = useMemo(
    () => (editingTaskId ? tasks.find((task) => task.id === editingTaskId) ?? null : null),
    [editingTaskId, tasks],
  );

  const [taskIdPendingDelete, setTaskIdPendingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const projectStart = useMemo(() => {
    if (!project) {
      return null;
    }
    const parsed = dayjs(project.createdAt);
    return parsed.isValid() ? parsed.startOf('day') : null;
  }, [project]);

  const { columnCount, taskDueDay } = useMemo(() => {
    if (!projectStart) {
      return { columnCount: MINIMUM_DAY_COLUMNS, taskDueDay: new Map<string, number>() };
    }

    let maxDay = MINIMUM_DAY_COLUMNS;
    const dueMap = new Map<string, number>();

    tasks.forEach((task) => {
      const dueDate = dayjs(task.endAt);
      if (!dueDate.isValid()) {
        return;
      }
      const dayOffset = Math.max(1, dueDate.startOf('day').diff(projectStart, 'day') + 1);
      dueMap.set(task.id, dayOffset);
      if (dayOffset > maxDay) {
        maxDay = dayOffset;
      }
    });

    return { columnCount: maxDay, taskDueDay: dueMap };
  }, [projectStart, tasks]);

  const dayColumns = useMemo(
    () => Array.from({ length: columnCount }, (_, index) => index + 1),
    [columnCount],
  );

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? DESKTOP_BREAKPOINT : window.innerWidth,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const visibleColumnCount = useMemo(
    () => getVisibleColumnCount(viewportWidth),
    [viewportWidth],
  );

  const tableWrapperStyles = useMemo(
    () =>
      ({
        '--project-grid-visible-columns': visibleColumnCount,
        '--project-grid-total-columns': columnCount,
      }) as CSSProperties,
    [columnCount, visibleColumnCount],
  );

  const handleAddEvent = () => {
    if (!projectId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'create');
    next.delete('task');
    setSearchParams(next, { replace: true });
  };

  const handleCloseModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('modal');
    next.delete('task');
    setSearchParams(next, { replace: true });
  };

  const handleOpenEdit = (taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'edit');
    next.set('task', taskId);
    setSearchParams(next, { replace: true });
  };

  const handleSubmitTask = async (input: TaskCreateInput, taskId?: string) => {
    if (isEditModalOpen && taskId) {
      await updateTask(taskId, input);
      return;
    }
    await createTask(input);
  };

  const handleDeleteRequest = (taskId: string) => {
    setTaskIdPendingDelete(taskId);
    setDeleteError(null);
  };

  const taskPendingDelete = useMemo(
    () => tasks.find((task) => task.id === taskIdPendingDelete) ?? null,
    [taskIdPendingDelete, tasks],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!taskIdPendingDelete) {
      return;
    }
    try {
      await deleteTask(taskIdPendingDelete);
      setDeleteError(null);
      setTaskIdPendingDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete task');
    }
  }, [deleteTask, taskIdPendingDelete]);

  const handleCancelDelete = () => {
    if (deleting) {
      return;
    }
    setTaskIdPendingDelete(null);
    setDeleteError(null);
  };

  const projectTitle = project?.name ?? (projectLoading ? 'Loading…' : 'Project');
  const projectDescription =
    projectError && projectErrorData instanceof Error ? projectErrorData.message : null;

  return (
    <div className="card project-detail">
      <div className="project-detail__header">
        <div>
          <h2 className="project-detail__title">{projectTitle}</h2>
          {projectError ? <p className="error-message">{projectDescription}</p> : null}
        </div>

      </div>

      {project && project.description ? (
        <p className="project-detail__description">{project.description}</p>
      ) : null}

      <section className="project-detail__events">
        <header className="project-detail__events-header">
          <h3>Project timeline</h3>
          <p>Scroll horizontally to explore the timeline. The highlighted cell marks each event.</p>
        </header>
        {tasksLoading ? <p>Loading events…</p> : null}
        {tasksError ? (
          <p className="error-message">
            {tasksErrorData instanceof Error ? tasksErrorData.message : 'Failed to load events'}
          </p>
        ) : null}
        <div className="project-grid">
          <div className="project-grid__table-wrapper" style={tableWrapperStyles}>
            <table className="project-grid__table">
              <thead>
                <tr>
                  <th scope="col" className="project-grid__header project-grid__header--title">
                    Event Name
                  </th>
                  {dayColumns.map((dayNumber) => (
                    <th key={dayNumber} scope="col" className="project-grid__header">
                      {dayNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              {tasks.length ? (
                <tbody>
                  {tasks.map((task) => {
                    const dueDay = taskDueDay.get(task.id);
                    return (
                      <tr key={task.id}>
                        <th scope="row" className="project-grid__row-header">
                          <div className="project-grid__event-header">
                            <div className="project-grid__event-text">
                              <span className="project-grid__event-name">{task.title}</span>
                              {task.description ? (
                                <span className="project-grid__event-description">{task.description}</span>
                              ) : null}
                            </div>
                            <div className="project-grid__event-actions">
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => handleOpenEdit(task.id)}
                                aria-label={`Edit ${task.title}`}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  focusable="false"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m16.862 4.487 1.651 1.651a1.875 1.875 0 0 1 0 2.652l-8.955 8.955a4.5 4.5 0 0 1-1.897 1.13l-3.068.878a.563.563 0 0 1-.69-.69l.878-3.068a4.5 4.5 0 0 1 1.13-1.897l8.955-8.955a1.875 1.875 0 0 1 2.652 0Z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19.5 7.125 16.875 4.5"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--danger"
                                onClick={() => handleDeleteRequest(task.id)}
                                aria-label={`Delete ${task.title}`}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  focusable="false"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 7.5h12M9.75 7.5V6a1.5 1.5 0 0 1 1.5-1.5h1.5A1.5 1.5 0 0 1 14.25 6v1.5m3 0V18a2.25 2.25 0 0 1-2.25 2.25h-6A2.25 2.25 0 0 1 6 18V7.5h12Z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M10.5 11.25v6m3-6v6"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </th>
                        {dayColumns.map((dayNumber) => {
                          const isDueDay = typeof dueDay === 'number' && dueDay === dayNumber;
                          return (
                            <td
                              key={dayNumber}
                              className={`project-grid__cell${isDueDay ? ' project-grid__cell--active' : ''}`}
                            >
                              {isDueDay ? <span className="project-grid__marker" aria-hidden="true" /> : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ) : null}
            </table>
          </div>
        </div>
        {!tasks.length && !tasksLoading ? (
          <p className="project-detail__empty">No events yet. Use Add Event to create one.</p>
        ) : null}
      </section>

      <div className="project-detail__actions">
          <button type="button" onClick={handleAddEvent} disabled={!projectId || projectLoading}>
            Add Event
          </button>
        </div>
      <TaskModal
        isOpen={isModalOpen}
        projects={project ? [project] : []}
        defaultProjectId={projectId}
        task={editingTask}
        mode={isEditModalOpen ? 'edit' : 'create'}
        submitting={isEditModalOpen ? updating : creating}
        onSubmit={handleSubmitTask}
        onClose={handleCloseModal}
      />
      <ConfirmDialog
        isOpen={Boolean(taskIdPendingDelete)}
        title="Delete task"
        message={
          <div className="confirm-dialog__message">
            {taskPendingDelete ? (
              <p>
                Are you sure you want to delete <strong>{taskPendingDelete.title}</strong>? This
                action cannot be undone.
              </p>
            ) : (
              <p>Are you sure you want to delete this task? This action cannot be undone.</p>
            )}
            {deleteError ? <p className="error-message">{deleteError}</p> : null}
          </div>
        }
        confirmLabel="Delete"
        submitting={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
