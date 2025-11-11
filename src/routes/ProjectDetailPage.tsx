import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type SVGProps,
} from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useParams, useSearchParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useTags } from '../hooks/useTags';
import { useTasks } from '../hooks/useTasks';
import { listNotes } from '../api/notes';
import TaskModal from '../components/TaskModal';
import TagModal from '../components/TagModal';
import type { NoteRes, TagCreateInput, TagRes, TaskRes, TaskWithNoteInput } from '../types';

dayjs.extend(customParseFormat);

const MINIMUM_DAY_COLUMNS = 30;
const MOBILE_COLUMN_COUNT = 20;
const TABLET_COLUMN_COUNT = 24;
const DESKTOP_COLUMN_COUNT = 30;

const DESKTOP_BREAKPOINT = 1440;
const TABLET_BREAKPOINT = 1024;

interface TaskNoteCacheEntry {
  note: NoteRes | null;
  taskUpdatedAt: string;
}

interface TaskTimelineEntry {
  entryType: 'task';
  item: TaskRes;
}

interface TagTimelineEntry {
  entryType: 'tag';
  item: TagRes;
}

type TimelineEntry = TaskTimelineEntry | TagTimelineEntry;

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
    data: tagsData,
    isLoading: tagsLoading,
    isError: tagsError,
    error: tagsErrorData,
    createTag,
    creating: creatingTag,
    deleteTag: deleteTagApi,
    deleting: deletingTag,
    updateTag: updateTagApi,
    updating: updatingTag,
  } = useTags(projectId);

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
  const tags: TagRes[] = tagsData?.content ?? [];
  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const tagEntries: TimelineEntry[] = tags.map((tag) => ({
      entryType: 'tag',
      item: tag,
    }));
    const taskEntries: TimelineEntry[] = tasks.map((task) => ({
      entryType: 'task',
      item: task,
    }));
    return [...tagEntries, ...taskEntries];
  }, [tags, tasks]);
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
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagModalMode, setTagModalMode] = useState<'create' | 'edit'>('create');
  const [tagForModal, setTagForModal] = useState<TagRes | null>(null);
  const [tagToDelete, setTagToDelete] = useState<TagRes | null>(null);
  const [isDeleteTagModalOpen, setIsDeleteTagModalOpen] = useState(false);
  const [tagDeleteError, setTagDeleteError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<TimelineEntry | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const projectStart = useMemo(() => {
    if (!project?.startDate) {
      return null;
    }
    const parsed = dayjs(project.startDate, 'DD-MM-YYYY', true);
    return parsed.isValid() ? parsed.startOf('day') : null;
  }, [project?.startDate]);

  const projectStartLabel = useMemo(() => {
    if (!project?.startDate) {
      return null;
    }
    const parsed = dayjs(project.startDate, 'DD-MM-YYYY', true);
    if (!parsed.isValid()) {
      return project.startDate;
    }
    return parsed.format('MMMM D, YYYY');
  }, [project?.startDate]);

  const projectStartDateTime = projectStart
    ? projectStart.toISOString()
    : project?.startDate ?? undefined;

  const { columnCount, taskDayRange } = useMemo(() => {
    if (!projectStart) {
      return {
        columnCount: MINIMUM_DAY_COLUMNS,
        taskDayRange: new Map<string, { start: number; end: number }>(),
      };
    }

    let maxDay = 0;
    const rangeMap = new Map<string, { start: number; end: number }>();

    timelineEntries.forEach(({ item }) => {
      const rawStartDate = item.startAt ? dayjs(item.startAt) : null;
      const rawEndDate = item.endAt ? dayjs(item.endAt) : null;

      const hasValidStart = rawStartDate?.isValid() ?? false;
      const hasValidEnd = rawEndDate?.isValid() ?? false;

      let startDay = hasValidStart
        ? Math.max(1, rawStartDate!.startOf('day').diff(projectStart, 'day') + 1)
        : null;
      let endDay = hasValidEnd
        ? Math.max(1, rawEndDate!.startOf('day').diff(projectStart, 'day') + 1)
        : null;

      const hasDuration = typeof item.duration === 'number' && item.duration > 0;

      if (!hasValidStart && hasValidEnd && hasDuration) {
        startDay = Math.max(1, endDay! - item.duration + 1);
      }

      if (hasValidStart && !hasValidEnd && hasDuration) {
        endDay = startDay! + item.duration - 1;
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
        const expectedEnd = normalizedStart + item.duration - 1;
        if (expectedEnd > normalizedEnd) {
          normalizedEnd = expectedEnd;
        }
      }

      rangeMap.set(item.id, { start: normalizedStart, end: normalizedEnd });

      if (normalizedEnd > maxDay) {
        maxDay = normalizedEnd;
      }
    });

    // Use the maximum day from tasks/tags, but ensure we have at least the minimum
    const finalColumnCount = Math.max(maxDay, MINIMUM_DAY_COLUMNS);
    
    // Add some padding (10 days) to the end for better visualization
    const paddedColumnCount = finalColumnCount + 10;

    return { columnCount: paddedColumnCount, taskDayRange: rangeMap };
  }, [projectStart, timelineEntries]);

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

  const timelineLoading = tasksLoading || tagsLoading;
  const showEmptyState = !timelineEntries.length && !timelineLoading;

  useEffect(() => {
    if (modalParam !== 'delete') {
      setDeleteError(null);
    }
  }, [modalParam]);

  const handleAddTag = () => {
    if (!projectId) {
      return;
    }
    setTagModalMode('create');
    setTagForModal(null);
    setIsTagModalOpen(true);
  };

  const handleCloseTagModal = () => {
    setIsTagModalOpen(false);
    setTagModalMode('create');
    setTagForModal(null);
  };

  const handleSubmitTag = async (input: TagCreateInput) => {
    if (tagModalMode === 'edit' && tagForModal) {
      await updateTagApi(tagForModal.id, input);
      return;
    }

    await createTag(input);
  };

  const handleEditTagRequest = (tagId: string) => {
    const tag = tags.find((item) => item.id === tagId);
    if (!tag) {
      return;
    }
    setTagModalMode('edit');
    setTagForModal(tag);
    setIsTagModalOpen(true);
  };

  const handleDeleteTagRequest = (tagId: string) => {
    const tag = tags.find((item) => item.id === tagId);
    if (!tag) {
      return;
    }
    setTagToDelete(tag);
    setTagDeleteError(null);
    setIsDeleteTagModalOpen(true);
  };

  const handleCloseDeleteTagModal = () => {
    if (deletingTag) {
      return;
    }
    setIsDeleteTagModalOpen(false);
    setTagToDelete(null);
    setTagDeleteError(null);
  };

  const handleDeleteTagConfirm = async () => {
    if (!tagToDelete) {
      return;
    }
    setTagDeleteError(null);
    try {
      await deleteTagApi(tagToDelete.id);
      handleCloseDeleteTagModal();
    } catch (error) {
      setTagDeleteError(error instanceof Error ? error.message : 'Failed to delete tag');
    }
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

  const handleTimelineHover = (entry: TimelineEntry, event: React.MouseEvent) => {
    setHoveredItem(entry);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleTimelineLeave = () => {
    setHoveredItem(null);
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
              {timelineEntries.length ? (
                <tbody>
                  {timelineEntries.map((entry) => {
                    const { item } = entry;
                    const dayRange = taskDayRange.get(item.id);
                    const isTag = entry.entryType === 'tag';
                    const resolvedNote =
                      entry.entryType === 'task'
                        ? entry.item.note ?? taskNotes[item.id]?.note ?? null
                        : null;
                    const noteBody =
                      typeof resolvedNote?.body === 'string' ? resolvedNote.body.trim() : '';
                    const hasNote = noteBody.length > 0;
                    const rowHeaderClassName = [
                      'project-grid__row-header',
                      isTag ? 'project-grid__row-header--tag' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <tr 
                        key={item.id}
                        onMouseEnter={(e) => handleTimelineHover(entry, e)}
                        onMouseLeave={handleTimelineLeave}
                        onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
                        style={{ cursor: 'pointer' }}
                      >
                        <th scope="row" className={rowHeaderClassName}>
                          <div className="project-grid__row-content">
                            <div className="project-grid__event-text">
                              <span className="project-grid__event-name">{item.title}</span>
                              {item.description ? (
                                <span className="project-grid__event-description">{item.description}</span>
                              ) : null}
                              {item.startAt ? (
                                <span className="project-grid__event-description">
                                  Starts: {dayjs(item.startAt).format('MMM D, YYYY')}
                                </span>
                              ) : null}
                              {item.endAt ? (
                                <span className="project-grid__event-description">
                                  Due: {dayjs(item.endAt).format('MMM D, YYYY')}
                                </span>
                              ) : null}
                              {Number.isFinite(item.duration) ? (
                                <span className="project-grid__event-description">
                                  Duration: {item.duration}{' '}
                                  {item.duration === 1 ? 'day' : 'days'}
                                </span>
                              ) : null}
                              {resolvedNote?.body ? (
                                <span className="project-grid__event-note">Note: {resolvedNote.body}</span>
                              ) : null}
                            </div>
                            <div className="project-grid__event-actions">
                              {entry.entryType === 'task' ? (
                                <>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button"
                                    onClick={() => handleEditTaskRequest(item.id)}
                                    aria-label={`Edit ${item.title}`}
                                  >
                                    <PencilIcon aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button project-grid__icon-button--danger"
                                    onClick={() => handleDeleteTaskRequest(item.id)}
                                    aria-label={`Delete ${item.title}`}
                                  >
                                    <TrashIcon aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button"
                                    onClick={() => handleEditTagRequest(item.id)}
                                    aria-label={`Edit ${item.title}`}
                                  >
                                    <PencilIcon aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button project-grid__icon-button--danger"
                                    onClick={() => handleDeleteTagRequest(item.id)}
                                    aria-label={`Delete ${item.title}`}
                                  >
                                    <TrashIcon aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </th>
                        {dayColumns.map((dayNumber) => {
                          const isActive =
                            typeof dayRange !== 'undefined' &&
                            dayRange.start <= dayNumber &&
                            dayNumber <= dayRange.end;
                          const isEndDay = isActive && dayRange.end === dayNumber;
                          const shouldShowNote = !isTag && isActive && hasNote;
                          const cellClassName = [
                            'project-grid__cell',
                            isActive ? 'project-grid__cell--active' : '',
                            shouldShowNote ? 'project-grid__cell--with-note' : '',
                          ]
                            .filter(Boolean)
                            .join(' ');
                          return (
                            <td key={dayNumber} className={cellClassName}>
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
        {hoveredItem && (
          <TimelineTooltip 
            entry={hoveredItem}
            position={tooltipPosition}
            taskNotes={taskNotes}
          />
        )}
        {showEmptyState ? (
          <p className="project-detail__empty">No events yet. Use Add Tag or Add Event to create one.</p>
        ) : null}
      </section>

      <div className="project-detail__actions">
        <button type="button" onClick={handleAddTag} disabled={!projectId || projectLoading}>
          Add Tag
        </button>
        <button type="button" onClick={handleAddEvent} disabled={!projectId || projectLoading}>
          Add Task
        </button>
      </div>
      <TagModal
        isOpen={isTagModalOpen}
        projects={project ? [project] : []}
        defaultProjectId={projectId}
        submitting={tagModalMode === 'edit' ? updatingTag : creatingTag}
        mode={tagModalMode}
        tag={tagForModal}
        onSubmit={handleSubmitTag}
        onClose={handleCloseTagModal}
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
      <DeleteTagModal
        isOpen={isDeleteTagModalOpen}
        tag={tagToDelete}
        submitting={deletingTag}
        error={tagDeleteError}
        onCancel={handleCloseDeleteTagModal}
        onConfirm={handleDeleteTagConfirm}
      />
    </div>
  );
}

interface TimelineTooltipProps {
  entry: TimelineEntry;
  position: { x: number; y: number };
  taskNotes: Record<string, TaskNoteCacheEntry>;
}

function TimelineTooltip({ entry, position, taskNotes }: TimelineTooltipProps) {
  const { item } = entry;
  const isTask = entry.entryType === 'task';
  const resolvedNote = isTask ? entry.item.note ?? taskNotes[item.id]?.note ?? null : null;

  return (
    <div
      className="timeline-tooltip"
      style={{
        position: 'fixed',
        left: position.x + 10,
        top: position.y - 10,
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '14px',
        maxWidth: '300px',
        zIndex: 1000,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        {isTask ? '📋' : '🏷️'} {item.title}
      </div>
      {resolvedNote?.body && (
        <div style={{ fontStyle: 'italic' }}>
          {resolvedNote.body.length > 100 
            ? `${resolvedNote.body.substring(0, 100)}...` 
            : resolvedNote.body}
        </div>
      )}
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

interface DeleteTagModalProps {
  isOpen: boolean;
  tag: TagRes | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteTagModal({
  isOpen,
  tag,
  submitting,
  error,
  onCancel,
  onConfirm,
}: DeleteTagModalProps) {
  if (!isOpen || !tag) {
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
        aria-labelledby="delete-tag-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="delete-tag-modal-title">Delete tag</h3>
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
            Are you sure you want to delete <strong>{tag.title}</strong>? This action cannot be undone.
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
            {submitting ? 'Deleting…' : 'Delete tag'}
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
