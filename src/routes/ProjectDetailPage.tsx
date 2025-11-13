import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type SVGProps,
} from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useTags } from '../hooks/useTags';
import { useTasks } from '../hooks/useTasks';
import { useAllActions } from '../hooks/useActions';
import { listNotes } from '../api/notes';
import { queryClient } from '../queryClient';
import TaskModal from '../components/TaskModal';
import TagModal from '../components/TagModal';
import type { NoteRes, TagCreateInput, TagRes, TaskRes, TaskWithNoteInput, ActionRes, ActionCreateInput, ActionUpdateInput } from '../types';

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
  const navigate = useNavigate();
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
  
  // Get all actions for timeline display
  const taskIds = useMemo(() => tasks.map(task => task.id), [tasks]);
  const {
    data: actionsData,
    isLoading: actionsLoading,
    isError: actionsError,
  } = useAllActions(taskIds);
  
  const actions: ActionRes[] = actionsData?.content ?? [];
  
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
          // Check if task was updated and invalidate cache if needed
          const currentTask = tasks.find(t => t.id === taskId);
          if (currentTask && entry.taskUpdatedAt !== currentTask.updatedAt) {
            // Don't include this entry - it will be refetched
            changed = true;
          } else {
            next[taskId] = entry;
          }
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
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [itemToInspect, setItemToInspect] = useState<TimelineEntry | null>(null);
  
  // Action-related state
  const [isActionConfirmModalOpen, setIsActionConfirmModalOpen] = useState(false);
  const [isActionCreateModalOpen, setIsActionCreateModalOpen] = useState(false);
  const [isActionViewModalOpen, setIsActionViewModalOpen] = useState(false);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{taskId: string; dayNumber: number} | null>(null);
  const [actionToView, setActionToView] = useState<ActionRes | null>(null);
  const [isActionEditMode, setIsActionEditMode] = useState(false);
  
  // Notification state for testing
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const [isTaskListModalOpen, setIsTaskListModalOpen] = useState(false);

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
      handleCloseTagModal();
      return;
    }

    await createTag(input);
    handleCloseTagModal();
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
    
    // Clear the cache for this task so it gets fresh data
    setTaskNotes((prev) => {
      const next = { ...prev };
      delete next[selectedTask.id];
      return next;
    });
    
    handleCloseModal();
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

  const handleInspectRequest = (entry: TimelineEntry) => {
    setItemToInspect(entry);
    setIsInspectModalOpen(true);
  };

  const handleCloseInspectModal = () => {
    setIsInspectModalOpen(false);
    setItemToInspect(null);
  };

  // Notification helper
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto-hide after 5 seconds
  };

  // Action-related handlers
  const handleCellClick = (taskId: string, dayNumber: number) => {
    // Check if there's already an action for this day
    const existingAction = actions.find(action => 
      action.taskId === taskId && action.day === dayNumber
    );
    
    if (existingAction) {
      // Show existing action
      setActionToView(existingAction);
      setIsActionEditMode(false);
      setIsActionViewModalOpen(true);
    } else {
      // Prompt to create new action
      setSelectedCellInfo({ taskId, dayNumber });
      setIsActionConfirmModalOpen(true);
    }
  };

  const handleCloseActionConfirmModal = () => {
    setIsActionConfirmModalOpen(false);
    setSelectedCellInfo(null);
  };

  const handleConfirmCreateAction = () => {
    setIsActionConfirmModalOpen(false);
    setIsActionCreateModalOpen(true);
  };

  const handleCloseActionCreateModal = () => {
    setIsActionCreateModalOpen(false);
    setSelectedCellInfo(null);
  };

  const handleCloseActionViewModal = () => {
    setIsActionViewModalOpen(false);
    setActionToView(null);
    setIsActionEditMode(false);
  };

  const handleActionEdit = () => {
    setIsActionEditMode(true);
  };

  const handleActionSave = async (details: string) => {
    if (!actionToView) {
      console.error('handleActionSave: No action to view');
      showNotification('❌ No action selected for update', 'error');
      return;
    }
    
    console.log('handleActionSave: Starting update for action:', actionToView);
    console.log('handleActionSave: New details:', details);
    
    try {
      const { updateAction } = await import('../api/actions');
      console.log('handleActionSave: Calling updateAction with ID:', actionToView.id);
      
      const updatedAction = await updateAction(actionToView.id, { details });
      console.log('handleActionSave: Update successful:', updatedAction);
      
      // Trigger refetch of actions
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      
      // Update the local action data and exit edit mode
      setActionToView({ ...actionToView, details });
      setIsActionEditMode(false);
      
      showNotification(`✅ Action updated successfully!`, 'success');
    } catch (error) {
      console.error('handleActionSave: Update failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
          errorMessage = 'CORS error - backend needs to allow requests from this domain';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error - check if backend is running';
        } else if (error.message.includes('404')) {
          errorMessage = 'Action not found - may have been deleted';
        } else {
          errorMessage = error.message;
        }
      }
      
      showNotification(`❌ Failed to update action: ${errorMessage}`, 'error');
      throw error;
    }
  };

  const handleActionDelete = async () => {
    if (!actionToView) return;
    
    try {
      const { deleteAction } = await import('../api/actions');
      await deleteAction(actionToView.id);
      // Trigger refetch of actions
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    } catch (error) {
      console.error('Failed to delete action:', error);
      throw error;
    }
  };

  const handleCreateAction = async (details: string) => {
    if (!selectedCellInfo) {
      const errorMsg = 'No cell selected for action creation';
      showNotification(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    
    const actionData = {
      taskId: selectedCellInfo.taskId,
      details,
      day: selectedCellInfo.dayNumber
    };
    
    showNotification(`Creating action for Day ${selectedCellInfo.dayNumber}...`, 'success');
    
    try {
      const { createAction } = await import('../api/actions');
      
      const newAction = await createAction(actionData);
      
      // Trigger refetch of actions
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      
      showNotification(`✅ Action created successfully for Day ${selectedCellInfo.dayNumber}!`, 'success');
      
    } catch (error) {
      let errorMessage = 'Failed to create action';
      
      if (error instanceof Error) {
        // Check for common error types
        if (error.message.includes('fetch') || error.name === 'TypeError') {
          errorMessage = `🌐 Network Error: Check console for URL details. Backend may not be running.`;
        } else if (error.message.includes('404')) {
          errorMessage = '🔍 API endpoint not found (404) - /actions endpoint missing';
        } else if (error.message.includes('500')) {
          errorMessage = '💥 Server error (500): Check backend logs';
        } else if (error.message.includes('400')) {
          errorMessage = '❌ Bad request (400): Check data format in console';
        } else {
          errorMessage = `❌ Error: ${error.message}`;
        }
      }
      
      // Also show the error in a longer notification for debugging
      showNotification(errorMessage, 'error');
      
      // Log additional debugging info
      console.error('🔧 DEBUGGING INFO:');
      console.error('Selected cell info:', selectedCellInfo);
      console.error('Action data sent:', actionData);
      
      throw error;
    }
  };

  const projectTitle = project?.name ?? (projectLoading ? 'Loading…' : 'Project');
  const projectDescription =
    projectError && projectErrorData instanceof Error ? projectErrorData.message : null;

  return (
    <div className="card project-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="back-button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#374151',
            fontSize: '14px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
            e.currentTarget.style.borderColor = '#9ca3af';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = '#d1d5db';
          }}
          aria-label="Back to Dashboard"
        >
          <ArrowLeftIcon style={{ width: '16px', height: '16px' }} aria-hidden="true" />
          Back to Dashboard
        </button>
        <button
          type="button"
          onClick={() => setIsTaskListModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: '#667eea',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: 'white',
            fontSize: '15px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#5568d3';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#667eea';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.25)';
          }}
          aria-label="View All Tasks"
        >
          <ListIcon style={{ width: '18px', height: '18px' }} aria-hidden="true" />
          View All Tasks
        </button>
      </div>
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
          <p style={{ 
            margin: '0 0 8px 0',
            color: '#6b7280',
            fontSize: '14px',
          }}>
            Click on any task colored cell to create an action for that day
          </p>
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
                    Task/Tag
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
                      >
                        <th scope="row" className={rowHeaderClassName}>
                          <div className="project-grid__row-content">
                            <div className="project-grid__event-text">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div 
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    backgroundColor: item.color || (isTag ? '#10b981' : '#3b82f6'),
                                    borderRadius: '3px',
                                    flexShrink: 0,
                                  }}
                                />
                                <span className="project-grid__event-name">{item.title}</span>
                              </div>
                              {Number.isFinite(item.duration) ? (
                                <span className="project-grid__event-description">
                                  Duration: {item.duration}{' '}
                                  {item.duration === 1 ? 'day' : 'days'}
                                </span>
                              ) : null}
                            </div>
                            <div className="project-grid__event-actions">
                              {entry.entryType === 'task' ? (
                                <>
                                  <button
                                    type="button"
                                    className="project-grid__icon-button"
                                    onClick={() => handleInspectRequest(entry)}
                                    aria-label={`View details for ${item.title}`}
                                  >
                                    <EyeIcon aria-hidden="true" />
                                  </button>
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
                                    onClick={() => handleInspectRequest(entry)}
                                    aria-label={`View details for ${item.title}`}
                                  >
                                    <EyeIcon aria-hidden="true" />
                                  </button>
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
                          
                          // Check if there's an action for this task and day (only for tasks, not tags)
                          const hasAction = !isTag && actions.some(action => 
                            action.taskId === item.id && action.day === dayNumber
                          );
                          
                          // Debug logging for first task and day 1 to verify actions are loaded
                          if (!isTag && item.id === tasks[0]?.id && dayNumber === 1) {
                            console.log('Debug - Actions for first task:', actions.filter(a => a.taskId === item.id));
                          }
                          
                          const cellClassName = [
                            'project-grid__cell',
                            isActive ? 'project-grid__cell--active' : '',
                            shouldShowNote ? 'project-grid__cell--with-note' : '',
                            hasAction ? 'project-grid__cell--with-action' : '',
                          ]
                            .filter(Boolean)
                            .join(' ');
                          
                          const cellProps = isActive ? {
                            onMouseEnter: (e: React.MouseEvent) => handleTimelineHover(entry, e),
                            onMouseLeave: handleTimelineLeave,
                            onMouseMove: (e: React.MouseEvent) => setTooltipPosition({ x: e.clientX, y: e.clientY }),
                            onClick: !isTag ? () => handleCellClick(item.id, dayNumber) : undefined,
                            style: { 
                              cursor: 'pointer',
                              backgroundColor: item.color || (isTag ? '#10b981' : '#3b82f6'),
                            }
                          } : {};
                          
                          return (
                            <td key={dayNumber} className={cellClassName} {...cellProps}>
                              {hasAction && (
                                <ActionIcon 
                                  aria-hidden="true"
                                  style={{ 
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 'calc(100% - 6px)',
                                    height: 'calc(100% - 6px)',
                                    maxWidth: '32px',
                                    maxHeight: '32px',
                                    minWidth: '20px',
                                    minHeight: '20px',
                                    color: '#1f2937',
                                    pointerEvents: 'none'
                                  }}
                                />
                              )}
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
      <InspectModal
        isOpen={isInspectModalOpen}
        entry={itemToInspect}
        taskNotes={taskNotes}
        onClose={handleCloseInspectModal}
      />
      <TaskListModal
        isOpen={isTaskListModalOpen}
        tasks={tasks}
        taskNotes={taskNotes}
        onClose={() => setIsTaskListModalOpen(false)}
      />
      <ActionConfirmModal
        isOpen={isActionConfirmModalOpen}
        onClose={handleCloseActionConfirmModal}
        onConfirm={handleConfirmCreateAction}
      />
      <ActionCreateModal
        isOpen={isActionCreateModalOpen}
        selectedCellInfo={selectedCellInfo}
        onClose={handleCloseActionCreateModal}
        onCreate={handleCreateAction}
      />
      <ActionViewModal
        isOpen={isActionViewModalOpen}
        action={actionToView}
        isEditMode={isActionEditMode}
        onClose={handleCloseActionViewModal}
        onEdit={handleActionEdit}
        onSave={handleActionSave}
        onDelete={handleActionDelete}
      />
      
      {/* Testing Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '16px 24px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            maxWidth: '400px',
            zIndex: 9999,
            backgroundColor: notification.type === 'success' ? '#16a34a' : '#dc2626',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
          }}
          onClick={() => setNotification(null)}
        >
          {notification.message}
          <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
            Click to dismiss
          </div>
        </div>
      )}
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '0',
        borderRadius: '12px',
        fontSize: '14px',
        maxWidth: '320px',
        zIndex: 1000,
        pointerEvents: 'none',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        overflow: 'hidden'
      }}
    >
      <div style={{ 
        fontWeight: '600', 
        padding: '12px 16px',
        fontSize: '15px',
        letterSpacing: '0.3px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: resolvedNote?.body ? '1px solid rgba(255, 255, 255, 0.25)' : 'none'
      }}>
        <span style={{ fontSize: '16px' }}>{isTask ? '📋' : '🏷️'}</span>
        {item.title}
      </div>
      {resolvedNote?.body && (
        <div style={{ 
          fontSize: '13px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '12px 16px'
        }}>
          {resolvedNote.body.length > 100 
            ? `${resolvedNote.body.substring(0, 100)}...` 
            : resolvedNote.body}
        </div>
      )}
    </div>
  );
}

interface TaskListModalProps {
  isOpen: boolean;
  tasks: TaskRes[];
  taskNotes: Record<string, TaskNoteCacheEntry>;
  onClose: () => void;
}

function TaskListModal({ isOpen, tasks, taskNotes, onClose }: TaskListModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    // Only close if clicking in the outer area, not near the modal
    const target = event.target as HTMLElement;
    const modal = event.currentTarget.querySelector('.modal');
    
    if (modal && target === event.currentTarget) {
      const rect = modal.getBoundingClientRect();
      const safeZone = 60; // 60px buffer around modal
      const clickX = event.clientX;
      const clickY = event.clientY;
      
      // Check if click is outside the safe zone
      const isOutsideSafeZone = 
        clickX < rect.left - safeZone ||
        clickX > rect.right + safeZone ||
        clickY < rect.top - safeZone ||
        clickY > rect.bottom + safeZone;
      
      if (isOutsideSafeZone) {
        onClose();
      }
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal task-list-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-list-modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '800px', width: '90vw' }}
      >
        <div className="modal-header" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '16px 20px',
        }}>
          <h3 id="task-list-modal-title" style={{ 
            margin: 0,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            <span style={{ fontSize: '20px' }}>📋</span>
            All Tasks ({tasks.length})
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close task list"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            ×
          </button>
        </div>
        
        <div className="task-list-modal__content" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {tasks.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              No tasks in this project yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.map((task) => {
                const resolvedNote = task.note ?? taskNotes[task.id]?.note ?? null;
                const startDate = task.startAt ? dayjs(task.startAt).format('MMM D, YYYY') : 'Not set';
                const endDate = task.endAt ? dayjs(task.endAt).format('MMM D, YYYY') : 'Not set';
                
                return (
                  <div 
                    key={task.id} 
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      backgroundColor: '#fff',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.12)';
                      e.currentTarget.style.borderColor = '#667eea';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    {/* Color and Title in same line */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div 
                        style={{
                          width: '10px',
                          height: '10px',
                          backgroundColor: task.color || '#667eea',
                          borderRadius: '3px',
                          flexShrink: 0,
                        }}
                      />
                      <h4 style={{ 
                        margin: 0, 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: '#111827',
                      }}>
                        {task.title}
                      </h4>
                    </div>
                    
                    {/* Description on separate line */}
                    {task.description && (
                      <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                        <div style={{ fontWeight: '500', color: '#374151', marginBottom: '4px', fontSize: '14px' }}>
                          Description:
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280', whiteSpace: 'pre-wrap' }}>
                          {task.description}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', fontSize: '14px' }}>
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Start Date:</span>
                        <div style={{ color: '#6b7280' }}>{startDate}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>End Date:</span>
                        <div style={{ color: '#6b7280' }}>{endDate}</div>
                      </div>
                      {Number.isFinite(task.duration) && task.duration! > 0 && (
                        <div>
                          <span style={{ fontWeight: '500', color: '#374151' }}>Duration:</span>
                          <div style={{ color: '#6b7280' }}>
                            {task.duration} {task.duration === 1 ? 'day' : 'days'}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {resolvedNote?.body && (
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                        <div style={{ fontWeight: '500', color: '#374151', marginBottom: '4px', fontSize: '14px' }}>
                          Note:
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280', whiteSpace: 'pre-wrap' }}>
                          {resolvedNote.body}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Action Modals
interface ActionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ActionConfirmModal({ isOpen, onClose, onConfirm }: ActionConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="action-confirm-modal-title">Add Action</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close confirmation"
          >
            ×
          </button>
        </div>
        
        <div>
          <p>Would you like to add an action for this day?</p>
        </div>
        
        <div className="modal-actions">
          <button type="button" className="button-success" onClick={onConfirm}>
            Add Action
          </button>
          <button type="button" className="button-danger" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionCreateModalProps {
  isOpen: boolean;
  selectedCellInfo: {taskId: string; dayNumber: number} | null;
  onClose: () => void;
  onCreate: (details: string) => Promise<void>;
}

function ActionCreateModal({ isOpen, selectedCellInfo, onClose, onCreate }: ActionCreateModalProps) {
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim() || !selectedCellInfo) return;
    
    console.log('ActionCreateModal: Starting submission with data:', {
      taskId: selectedCellInfo.taskId,
      dayNumber: selectedCellInfo.dayNumber,
      details: details.trim()
    });
    
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(details.trim());
      console.log('ActionCreateModal: Action created successfully, closing modal');
      setDetails('');
      onClose();
    } catch (error) {
      console.error('ActionCreateModal: Failed to create action:', error);
      setError(error instanceof Error ? error.message : 'Failed to create action');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setDetails('');
    onClose();
  };

  if (!isOpen || !selectedCellInfo) {
    return null;
  }

  const handleBackdropClick = () => {
    handleClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-create-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="action-create-modal-title">Create Action for Day {selectedCellInfo.dayNumber}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Close create action"
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="action-details">Action Details</label>
            <textarea
              id="action-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Enter the action details..."
              rows={4}
              required
              disabled={isSubmitting}
            />
          </div>
          
          {error && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
          
          {selectedCellInfo && (
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
              Creating action for Task ID: {selectedCellInfo.taskId}, Day: {selectedCellInfo.dayNumber}
            </div>
          )}
          
          <div className="modal-actions">
            <button type="submit" className="button-success" disabled={isSubmitting || !details.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </button>
            <button type="button" className="button-danger" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ActionViewModalProps {
  isOpen: boolean;
  action: ActionRes | null;
  isEditMode: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave: (details: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function ActionViewModal({ isOpen, action, isEditMode, onClose, onEdit, onSave, onDelete }: ActionViewModalProps) {
  const [editDetails, setEditDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Update edit details when action changes
  useEffect(() => {
    if (action) {
      setEditDetails(action.details);
    }
  }, [action]);

  // Clear error when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setSaveError(null);
    }
  }, [isEditMode]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDetails.trim() || !action) return;
    
    setIsSubmitting(true);
    setSaveError(null);
    try {
      await onSave(editDetails.trim());
      // Success - parent component should handle exiting edit mode
    } catch (error) {
      console.error('Failed to update action:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save action');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!action) return;
    
    setIsSubmitting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete action:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  if (!isOpen || !action) {
    return null;
  }

  const handleBackdropClick = () => {
    handleClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-view-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="action-view-modal-title">Action for Day {action.day}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Close action view"
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>
        
        {isEditMode ? (
          <form onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="edit-action-details">Action Details</label>
              <textarea
                id="edit-action-details"
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                rows={4}
                required
                disabled={isSubmitting}
              />
            </div>
            
            {saveError && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                {saveError}
              </div>
            )}
            
            <div className="modal-actions">
              <button type="button" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button 
                type="submit" 
                style={{
                  backgroundColor: 'white',
                  color: '#1f2937',
                  border: '1px solid #d1d5db'
                }}
                disabled={isSubmitting || !editDetails.trim()}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="action-view-content">
              <div className="field">
                <label>Action Details</label>
                <p style={{ 
                  background: '#f8fafc', 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  border: '1px solid #e2e8f0',
                  whiteSpace: 'pre-wrap',
                  margin: '0'
                }}>
                  {action.details}
                </p>
              </div>
            </div>
            
            <div className="modal-actions">
              <button type="button" onClick={handleClose}>
                Close
              </button>
              <button type="button" onClick={onEdit} disabled={isSubmitting}>
                Edit
              </button>
              <button 
                type="button" 
                className="button-danger" 
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface InspectModalProps {
  isOpen: boolean;
  entry: TimelineEntry | null;
  taskNotes: Record<string, TaskNoteCacheEntry>;
  onClose: () => void;
}

function InspectModal({ isOpen, entry, taskNotes, onClose }: InspectModalProps) {
  if (!isOpen || !entry) {
    return null;
  }

  const { item } = entry;
  const isTask = entry.entryType === 'task';
  const resolvedNote = isTask ? entry.item.note ?? taskNotes[item.id]?.note ?? null : null;
  
  // Calculate duration
  const duration = (() => {
    if (Number.isFinite(item.duration) && item.duration! > 0) {
      return `${item.duration} ${item.duration === 1 ? 'day' : 'days'}`;
    }
    
    if (item.startAt && item.endAt) {
      const start = dayjs(item.startAt);
      const end = dayjs(item.endAt);
      if (start.isValid() && end.isValid()) {
        const diff = end.diff(start, 'day') + 1;
        return `${diff} ${diff === 1 ? 'day' : 'days'}`;
      }
    }
    
    return 'Not specified';
  })();

  const handleBackdropClick = (event: React.MouseEvent) => {
    // Only close if clicking in the outer area, not near the modal
    const target = event.target as HTMLElement;
    const modal = event.currentTarget.querySelector('.modal');
    
    if (modal && target === event.currentTarget) {
      const rect = modal.getBoundingClientRect();
      const safeZone = 60; // 60px buffer around modal
      const clickX = event.clientX;
      const clickY = event.clientY;
      
      // Check if click is outside the safe zone
      const isOutsideSafeZone = 
        clickX < rect.left - safeZone ||
        clickX > rect.right + safeZone ||
        clickY < rect.top - safeZone ||
        clickY > rect.bottom + safeZone;
      
      if (isOutsideSafeZone) {
        onClose();
      }
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal inspect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspect-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="inspect-modal-title">
            {isTask ? '📋' : '🏷️'} {isTask ? 'Task' : 'Tag'} Details
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close details view"
          >
            ×
          </button>
        </div>
        
        <div className="inspect-modal__content">
          <div className="inspect-modal__section">
            <h4 className="inspect-modal__label">Title</h4>
            <p className="inspect-modal__value">{item.title}</p>
          </div>

          <div className="inspect-modal__divider" />

          <div className="inspect-modal__section">
            <h4 className="inspect-modal__label">Description</h4>
            <p className="inspect-modal__value" style={{ whiteSpace: 'pre-wrap' }}>
              {item.description || 'No description provided'}
            </p>
          </div>

          <div className="inspect-modal__divider" />

          <div className="inspect-modal__section">
            <h4 className="inspect-modal__label">Start Date</h4>
            <p className="inspect-modal__value">
              {item.startAt 
                ? dayjs(item.startAt).format('MMMM D, YYYY') 
                : 'Not specified'
              }
            </p>
          </div>

          <div className="inspect-modal__divider" />

          <div className="inspect-modal__section">
            <h4 className="inspect-modal__label">End Date</h4>
            <p className="inspect-modal__value">
              {item.endAt 
                ? dayjs(item.endAt).format('MMMM D, YYYY') 
                : 'Not specified'
              }
            </p>
          </div>

          <div className="inspect-modal__divider" />

          <div className="inspect-modal__section">
            <h4 className="inspect-modal__label">Duration</h4>
            <p className="inspect-modal__value">{duration}</p>
          </div>

          {resolvedNote?.body && (
            <>
              <div className="inspect-modal__divider" />
              <div className="inspect-modal__section">
                <h4 className="inspect-modal__label">Notes</h4>
                <p className="inspect-modal__value inspect-modal__notes" style={{ whiteSpace: 'pre-wrap' }}>
                  {resolvedNote.body}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
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

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (submitting) {
      return;
    }
    
    // Only close if clicking in the outer area, not near the modal
    const target = event.target as HTMLElement;
    const modal = event.currentTarget.querySelector('.modal');
    
    if (modal && target === event.currentTarget) {
      const rect = modal.getBoundingClientRect();
      const safeZone = 60; // 60px buffer around modal
      const clickX = event.clientX;
      const clickY = event.clientY;
      
      // Check if click is outside the safe zone
      const isOutsideSafeZone = 
        clickX < rect.left - safeZone ||
        clickX > rect.right + safeZone ||
        clickY < rect.top - safeZone ||
        clickY > rect.bottom + safeZone;
      
      if (isOutsideSafeZone) {
        onCancel();
      }
    }
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

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (submitting) {
      return;
    }
    
    // Only close if clicking in the outer area, not near the modal
    const target = event.target as HTMLElement;
    const modal = event.currentTarget.querySelector('.modal');
    
    if (modal && target === event.currentTarget) {
      const rect = modal.getBoundingClientRect();
      const safeZone = 60; // 60px buffer around modal
      const clickX = event.clientX;
      const clickY = event.clientY;
      
      // Check if click is outside the safe zone
      const isOutsideSafeZone = 
        clickX < rect.left - safeZone ||
        clickX > rect.right + safeZone ||
        clickY < rect.top - safeZone ||
        clickY > rect.bottom + safeZone;
      
      if (isOutsideSafeZone) {
        onCancel();
      }
    }
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

function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

function ActionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M17.5 5.5L16 4l-4 4 1.5 1.5 4-4zm2 2L18 6l-4 4 1.5 1.5 4-4zM9 13l-4 4 1.5 1.5L10.5 14.5 9 13zm-2-2l4-4L9.5 5.5 5.5 9.5 7 11z" />
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}

function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  );
}

function ListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  );
}
