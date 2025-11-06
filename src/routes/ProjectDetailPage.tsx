import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type SVGProps,
} from 'react';
import dayjs from 'dayjs';
import { useParams, useSearchParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useTasks } from '../hooks/useTasks';
import { useTags } from '../hooks/useTags';
import { listNotes } from '../api/notes';
import TagModal from '../components/TagModal';
import TaskModal from '../components/TaskModal';
import type { NoteRes, TagCreateInput, TagRes, TaskRes, TaskWithNoteInput } from '../types';

const MINIMUM_DAY_COLUMNS = 100;
const MOBILE_COLUMN_COUNT = 20;
const TABLET_COLUMN_COUNT = 24;
const DESKTOP_COLUMN_COUNT = 30;

const DESKTOP_BREAKPOINT = 1440;
const TABLET_BREAKPOINT = 1024;

interface TaskNoteCacheEntry {
  note: NoteRes | null;
  taskUpdatedAt: string;
}

type TimelineItem =
  | { kind: 'tag'; id: string; tag: TagRes }
  | { kind: 'task'; id: string; task: TaskRes };

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
  const isTagModalOpen = modalParam === 'create-tag';

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

  const {
    data: tagsData,
    isLoading: tagsLoading,
    isError: tagsError,
    error: tagsErrorData,
    createTag,
    creating: creatingTag,
  } = useTags(projectId);

  const tags: TagRes[] = tagsData?.content ?? [];
  const tasks: TaskRes[] = tasksData?.content ?? [];

  const timelineItems: TimelineItem[] = useMemo(
    () => [
      ...tags.map((tag) => ({ kind: 'tag' as const, id: `tag:${tag.id}`, tag })),
      ...tasks.map((task) => ({ kind: 'task' as const, id: `task:${task.id}`, task })),
    ],
    [tags, tasks],
  );

  const timelineLoading = tasksLoading || tagsLoading;
  const [taskNotes, setTaskNotes] = useState<Record<string, TaskNoteCacheEntry>>({});
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const [selectedTaskNote, setSelectedTaskNote] = useState<TaskRes['note'] | null>(null);

  useEffect(() => {
    if (!tasks.length) {
      setTaskNotes({});
      return;
    }

    const validTaskIds = new Set(tasks.map((task) => task.id));

    setTaskNotes((prev) => {
      const next: Record<string, TaskNoteCacheEntry> = {};
      let changed = false;

      Object.entries(prev).forEach(([taskId, entry]) => {
        if (validTaskIds.has(taskId)) {
          next[taskId] = entry;
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tasks]);

  useEffect(() => {
    if (!tasks.length) {
      return;
    }

    const tasksNeedingNotes = tasks.filter((task) => {
      if (task.note !== undefined) {
        return false;
      }

      const cacheEntry = taskNotes[task.id];
      if (!cacheEntry) {
        return true;
      }

      return cacheEntry.taskUpdatedAt !== task.updatedAt;
    });

    if (!tasksNeedingNotes.length) {
      return;
    }

    let ignore = false;

    (async () => {
      try {
        const results = await Promise.all(
          tasksNeedingNotes.map(async (task) => {
            const response = await listNotes({ taskId: task.id, size: 1 });
            return {
              taskId: task.id,
              taskUpdatedAt: task.updatedAt,
              note: response.content[0] ?? null,
            };
          }),
        );

        if (ignore) {
          return;
        }

        setTaskNotes((prev) => {
          const next: Record<string, TaskNoteCacheEntry> = { ...prev };
          let changed = false;

          results.forEach(({ taskId, taskUpdatedAt, note }) => {
            const existing = next[taskId];
            if (
              !existing ||
              existing.taskUpdatedAt !== taskUpdatedAt ||
              existing.note?.id !== note?.id ||
              existing.note?.body !== note?.body
            ) {
              next[taskId] = { note, taskUpdatedAt };
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      } catch (error) {
        if (ignore) {
          return;
        }

        setTaskNotes((prev) => {
          const next: Record<string, TaskNoteCacheEntry> = { ...prev };
          let changed = false;

          tasksNeedingNotes.forEach((task) => {
            const existing = next[task.id];
            if (!existing || existing.taskUpdatedAt !== task.updatedAt || existing.note !== null) {
              next[task.id] = { note: null, taskUpdatedAt: task.updatedAt };
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      }
    })();

    return () => {
      ignore = true;
    };
  }, [taskNotes, tasks]);

  useEffect(() => {
    if (!selectedTask) {
      setSelectedTaskNote(null);
      return;
    }

    setSelectedTaskNote(selectedTask.note ?? taskNotes[selectedTask.id]?.note ?? null);

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
  }, [modalParam, selectedTask, taskNotes]);

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
    if (!project?.startDate) {
      return null;
    }
    const parsed = dayjs(project.startDate);
    return parsed.isValid() ? parsed.startOf('day') : null;
  }, [project?.startDate]);

  const projectStartLabel = useMemo(() => {
    if (!project?.startDate) {
      return null;
    }
    const parsed = dayjs(project.startDate);
    if (!parsed.isValid()) {
      return project.startDate;
    }
    return parsed.format('MMMM D, YYYY');
  }, [project?.startDate]);

  const projectStartDateTime = projectStart
    ? projectStart.toISOString()
    : project?.startDate ?? undefined;

  const { columnCount, itemDayRange } = useMemo(() => {
    if (!projectStart) {
      return {
        columnCount: MINIMUM_DAY_COLUMNS,
        itemDayRange: new Map<string, { start: number; end: number }>(),
      };
    }

    let maxDay = MINIMUM_DAY_COLUMNS;
    const rangeMap = new Map<string, { start: number; end: number }>();

    timelineItems.forEach((item: TimelineItem) => {
      const entity = item.kind === 'task' ? item.task : item.tag;
      const rawStartDate = entity.startAt ? dayjs(entity.startAt) : null;
      const rawEndDate = entity.endAt ? dayjs(entity.endAt) : null;

      const hasValidStart = rawStartDate?.isValid() ?? false;
      const hasValidEnd = rawEndDate?.isValid() ?? false;

      let startDay = hasValidStart
        ? Math.max(1, rawStartDate!.startOf('day').diff(projectStart, 'day') + 1)
        : null;
      let endDay = hasValidEnd
        ? Math.max(1, rawEndDate!.startOf('day').diff(projectStart, 'day') + 1)
        : null;

      const hasDuration = typeof entity.duration === 'number' && entity.duration > 0;

      if (!hasValidStart && hasValidEnd && hasDuration) {
        startDay = Math.max(1, endDay! - entity.duration + 1);
      }

      if (hasValidStart && !hasValidEnd && hasDuration) {
        endDay = startDay! + entity.duration - 1;
      }

      if (startDay === null && endDay === null) {
        return;
      }

      const tentativeStart = startDay ?? endDay;
      const tentativeEnd = endDay ?? startDay;

      if (tentativeStart === null || tentativeEnd === null) {
        return;
      }

      let normalizedStart = Math.min(tentativeStart, tentativeEnd);
      let normalizedEnd = Math.max(tentativeStart, tentativeEnd);

      if (hasDuration) {
        const expectedEnd = normalizedStart + entity.duration - 1;
        if (expectedEnd > normalizedEnd) {
          normalizedEnd = expectedEnd;
        }
      }

      rangeMap.set(item.id, { start: normalizedStart, end: normalizedEnd });

      if (normalizedEnd > maxDay) {
        maxDay = normalizedEnd;
      }
    });

    return { columnCount: maxDay, itemDayRange: rangeMap };
  }, [projectStart, timelineItems]);

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

  const handleAddTag = () => {
    if (!projectId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'create-tag');
    next.delete('taskId');
    setSearchParams(next, { replace: true });
  };

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

  const handleCreateTag = async (input: TagCreateInput) => {
    await createTag(input);
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
          {projectStartLabel ? (
            <p className="project-detail__description project-detail__description--meta">
              Project start date:{' '}
              <time dateTime={projectStartDateTime}>{projectStartLabel}</time>
            </p>
          ) : null}
        </div>

      </div>

      {project && project.description ? (
        <p className="project-detail__description">{project.description}</p>
      ) : null}
      <section className="project-detail__events">
        <header className="project-detail__events-header">
          <h3>Project timeline</h3>
          <p>Scroll horizontally to explore the timeline. The highlighted cell marks each event.</p>
          {projectStartLabel ? (
            <p className="project-detail__events-meta">
              Project start date:{' '}
              <time dateTime={projectStartDateTime}>{projectStartLabel}</time>
            </p>
          ) : null}
        </header>
        {timelineLoading ? <p>Loading events…</p> : null}
        {tasksError ? (
          <p className="error-message">
            {tasksErrorData instanceof Error ? tasksErrorData.message : 'Failed to load events'}
          </p>
        ) : null}
        {tagsError ? (
          <p className="error-message">
            {tagsErrorData instanceof Error ? tagsErrorData.message : 'Failed to load tags'}
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
              {timelineItems.length ? (
                <tbody>
                  {timelineItems.map((item) => {
                    const isTask = item.kind === 'task';
                    const entity = isTask ? item.task : item.tag;
                    const taskEntity = isTask ? item.task : null;
                    const dayRange = itemDayRange.get(item.id);
                    const resolvedNote = taskEntity
                      ? taskEntity.note ?? taskNotes[taskEntity.id]?.note ?? null
                      : null;
                    const noteBody =
                      typeof resolvedNote?.body === 'string' ? resolvedNote.body.trim() : '';
                    const hasNote = Boolean(taskEntity && noteBody.length > 0);
                    return (
                      <tr key={item.id}>
                        <th scope="row" className="project-grid__row-header">
                          <div className="project-grid__row-content">
                            <div className="project-grid__event-text">
                              <span className="project-grid__event-name">{entity.title}</span>
                              {item.kind === 'tag' ? (
                                <span className="project-grid__event-description">Tag</span>
                              ) : null}
                              {entity.description ? (
                                <span className="project-grid__event-description">
                                  {entity.description}
                                </span>
                              ) : null}
                              {entity.startAt ? (
                                <span className="project-grid__event-description">
                                  Starts: {dayjs(entity.startAt).format('MMM D, YYYY')}
                                </span>
                              ) : null}
                              {entity.endAt ? (
                                <span className="project-grid__event-description">
                                  Due: {dayjs(entity.endAt).format('MMM D, YYYY')}
                                </span>
                              ) : null}
                              {Number.isFinite(entity.duration) ? (
                                <span className="project-grid__event-description">
                                  Duration: {entity.duration}{' '}
                                  {entity.duration === 1 ? 'day' : 'days'}
                                </span>
                              ) : null}
                              {isTask && resolvedNote?.body ? (
                                <span className="project-grid__event-note">Note: {resolvedNote.body}</span>
                              ) : null}
                            </div>
                            <div className="project-grid__event-actions">
                              {isTask ? (
                                <>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button"
                                    onClick={() => handleEditTaskRequest(entity.id)}
                                    aria-label={`Edit ${entity.title}`}
                                  >
                                    <PencilIcon aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button project-grid__icon-button--danger"
                                    onClick={() => handleDeleteTaskRequest(entity.id)}
                                    aria-label={`Delete ${entity.title}`}
                                  >
                                    <TrashIcon aria-hidden="true" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </th>
                        {dayColumns.map((dayNumber) => {
                          const isActive =
                            typeof dayRange !== 'undefined' &&
                            dayRange.start <= dayNumber &&
                            dayNumber <= dayRange.end;
                          const isEndDay = isActive && dayRange.end === dayNumber;
                          const shouldShowNote = isActive && hasNote;
                          const cellClassName = [
                            'project-grid__cell',
                            isActive ? 'project-grid__cell--active' : '',
                            shouldShowNote ? 'project-grid__cell--with-note' : '',
                          ]
                            .filter(Boolean)
                            .join(' ');
                          return (
                            <td
                              key={dayNumber}
                              className={cellClassName}
                            >
                              {isEndDay ? <span className="project-grid__marker" aria-hidden="true" /> : null}
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
        {!timelineItems.length && !timelineLoading ? (
          <p className="project-detail__empty">
            No events yet. Use Add Tag or Add Event to create one.
          </p>
        ) : null}
      </section>

      <div className="project-detail__actions">
        <button type="button" onClick={handleAddTag} disabled={!projectId || projectLoading}>
          Add Tag
        </button>
        <button type="button" onClick={handleAddEvent} disabled={!projectId || projectLoading}>
          Add Event
        </button>
      </div>
      <TagModal
        isOpen={isTagModalOpen}
        projects={project ? [project] : []}
        defaultProjectId={projectId}
        submitting={creatingTag}
        onSubmit={handleCreateTag}
        onClose={handleCloseModal}
      />
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
