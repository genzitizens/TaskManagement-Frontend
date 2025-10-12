import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useTasks } from '../hooks/useTasks';

const MINIMUM_DAY_COLUMNS = 100;

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

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
  } = useTasks(projectId);

  const tasks = tasksData?.content ?? [];

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

  const handleAddEvent = () => {
    if (!projectId) {
      return;
    }
    navigate(`/tasks?projectId=${projectId}`);
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
        <button type="button" onClick={handleAddEvent} disabled={!projectId || projectLoading}>
          Add Event
        </button>
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
          <div className="project-grid__table-wrapper">
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
                          <span className="project-grid__event-name">{task.title}</span>
                          {task.description ? (
                            <span className="project-grid__event-description">{task.description}</span>
                          ) : null}
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
    </div>
  );
}
