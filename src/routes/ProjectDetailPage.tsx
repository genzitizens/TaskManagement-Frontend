import { useEffect, useMemo, useState, type CSSProperties, type SVGProps } from 'react';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useTasks } from '../hooks/useTasks';
import { listNotes } from '../api/notes';
import TaskModal from '../components/TaskModal';
import type { TaskRes, TaskWithNoteInput } from '../types';

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
  const selectedTaskId = searchParams.get('taskId');
  const isCreateModalOpen = modalParam === 'create';

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

  const tasks: TaskRes[] = tasksData?.content ?? [];

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const [selectedTaskNote, setSelectedTaskNote] = useState<TaskRes['note'] | null>(null);

  useEffect(() => {
    if (!selectedTask) {
      setSelectedTaskNote(null);
      return;
    }

    setSelectedTaskNote(selectedTask.note ?? null);

    if (modalParam !== 'edit' || selectedTask.note) {
      return;
    }

    let ignore = false;

    (async () => {
      try {
        const response = await listNotes({ taskId: selectedTask.id, size: 1 });
        if (!ignore) {
          setSelectedTaskNote(response.content[0] ?? null);
        }
      } catch (error) {
        if (!ignore) {
          setSelectedTaskNote(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [modalParam, selectedTask]);

  const taskForModal = useMemo<TaskRes | null>(() => {
    if (!selectedTask) {
      return null;
    }

    if (modalParam !== 'edit') {
      return selectedTask;
    }

    const effectiveNote = selectedTaskNote ?? selectedTask.note ?? null;

    if (selectedTask.note === effectiveNote) {
      return selectedTask.note === undefined ? { ...selectedTask, note: null } : selectedTask;
    }

    return { ...selectedTask, note: effectiveNote };
  }, [modalParam, selectedTask, selectedTaskNote]);

  const isEditModalOpen = modalParam === 'edit' && Boolean(selectedTask);
  const isDeleteModalOpen = modalParam === 'delete' && Boolean(selectedTask);
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

    tasks.forEach((task: TaskRes) => {
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

  useEffect(() => {
    if (modalParam !== 'delete') {
      setDeleteError(null);
    }
  }, [modalParam]);

  const handleAddEvent = () => {
    if (!projectId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'create');
    next.delete('taskId');
    setSearchParams(next, { replace: true });
  };

  const handleEditTaskRequest = (taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'edit');
    next.set('taskId', taskId);
    setSearchParams(next, { replace: true });
  };

  const handleDeleteTaskRequest = (taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'delete');
    next.set('taskId', taskId);
    setDeleteError(null);
    setSearchParams(next, { replace: true });
  };

  const handleCloseModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('modal');
    next.delete('taskId');
    setSearchParams(next, { replace: true });
    setDeleteError(null);
  };

  const handleCreateTask = async (input: TaskWithNoteInput) => {
    await createTask(input);
  };

  const handleUpdateTask = async (input: TaskWithNoteInput) => {
    if (!selectedTask) {
      return;
    }
    await updateTask(selectedTask.id, input.task, input.noteAction);
  };

  const handleDeleteTaskConfirm = async () => {
    if (!selectedTask) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteTask(selectedTask.id);
      handleCloseModal();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete task');
    }
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
                  {tasks.map((task: TaskRes) => {
                    const dueDay = taskDueDay.get(task.id);
                    return (
                      <tr key={task.id}>
                        <th scope="row" className="project-grid__row-header">
                          <div className="project-grid__row-content">
                            <div className="project-grid__event-text">
                              <span className="project-grid__event-name">{task.title}</span>
                              {task.description ? (
                                <span className="project-grid__event-description">{task.description}</span>
                              ) : null}
                              {Number.isFinite(task.duration) ? (
                                <span className="project-grid__event-description">
                                  Duration: {task.duration}{' '}
                                  {task.duration === 1 ? 'day' : 'days'}
                                </span>
                              ) : null}
                              {task.note?.body ? (
                                <span className="project-grid__event-note">Note: {task.note.body}</span>
                              ) : null}
                            </div>
                            <div className="project-grid__event-actions">
                              <button
                                type="button"
                                className="project-grid__icon-button"
                                onClick={() => handleEditTaskRequest(task.id)}
                                aria-label={`Edit ${task.title}`}
                              >
                                <PencilIcon aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="project-grid__icon-button project-grid__icon-button--danger"
                                onClick={() => handleDeleteTaskRequest(task.id)}
                                aria-label={`Delete ${task.title}`}
                              >
                                <TrashIcon aria-hidden="true" />
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
        isOpen={isCreateModalOpen}
        projects={project ? [project] : []}
        defaultProjectId={projectId}
        submitting={creating}
        onSubmit={handleCreateTask}
        onClose={handleCloseModal}
      />
      <TaskModal
        isOpen={isEditModalOpen}
        mode="edit"
        task={taskForModal}
        projects={project ? [project] : []}
        defaultProjectId={selectedTask?.projectId ?? projectId}
        submitting={updating}
        onSubmit={handleUpdateTask}
        onClose={handleCloseModal}
      />
      <DeleteTaskModal
        isOpen={isDeleteModalOpen}
        task={selectedTask}
        submitting={deleting}
        error={deleteError}
        onCancel={handleCloseModal}
        onConfirm={handleDeleteTaskConfirm}
      />
    </div>
  );
}

interface DeleteTaskModalProps {
  isOpen: boolean;
  task: TaskRes | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteTaskModal({
  isOpen,
  task,
  submitting,
  error,
  onCancel,
  onConfirm,
}: DeleteTaskModalProps) {
  if (!isOpen || !task) {
    return null;
  }

  const handleBackdropClick = () => {
    if (submitting) {
      return;
    }
    onCancel();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-task-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="delete-task-modal-title">Delete task</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Close delete confirmation"
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <div>
          <p>
            Are you sure you want to delete <strong>{task.title}</strong>? This action cannot be undone.
          </p>
          {error ? <p className="error-message">{error}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={() => {
              void onConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M3 17.25V21h3.75l9.92-9.92-3.75-3.75L3 17.25zm2.92 1.83-.42-1.57 8.49-8.5 1.58 1.58-8.5 8.49-1.15.22z" />
      <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M5 7h14l-1 14H6L5 7zm4 2v10h2V9H9zm4 0v10h2V9h-2z" />
      <path d="M9 4h6l1 1h5v2H3V5h5l1-1z" />
    </svg>
  );
}
