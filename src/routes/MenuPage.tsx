import { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useProjects } from '../hooks/useProjects';
import ProjectModal from '../components/ProjectModal';
import type { ProjectCreateInput, ProjectRes } from '../types';

dayjs.extend(relativeTime);

export default function MenuPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    createProject,
    creating,
    updateProject,
    updating,
  } = useProjects();
  const projects = data?.content ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<ProjectRes | null>(null);

  const openCreateModal = () => {
    setActiveProject(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project: ProjectRes) => {
    setActiveProject(project);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setActiveProject(null);
  };

  const handleSubmit = async (input: ProjectCreateInput) => {
    if (activeProject) {
      await updateProject({ id: activeProject.id, input });
    } else {
      await createProject(input);
    }
  };

  const handleShowProject = (project: ProjectRes) => {
    console.debug('Show project requested', project);
  };

  const isSubmitting = activeProject ? updating : creating;

  return (
    <div className="menu-page">
      <div className="menu-header">
        <div>
          <h2>Menu</h2>
          <p className="menu-subtitle">Browse your projects and jump into the details.</p>
        </div>
        <button type="button" onClick={openCreateModal}>
          Add Project
        </button>
      </div>

      {isLoading ? <p>Loading projects…</p> : null}
      {isError ? (
        <p className="error-message">{error instanceof Error ? error.message : 'Failed to load projects'}</p>
      ) : null}
      {!isLoading && !isError && !projects.length ? <p>No projects yet.</p> : null}

      <div className="menu-list">
        {projects.map((project) => (
          <article key={project.id} className="menu-card">
            <header className="menu-card-header">
              <h3>{project.name}</h3>
              <p className="menu-card-meta">Updated {dayjs(project.updatedAt).fromNow()}</p>
            </header>
            {project.description ? (
              <p className="menu-card-description">{project.description}</p>
            ) : (
              <p className="menu-card-description menu-card-description--empty">No description provided.</p>
            )}
            <div className="menu-card-actions">
              <button type="button" className="button-secondary" onClick={() => openEditModal(project)}>
                Edit
              </button>
              <button type="button" className="button-secondary" onClick={() => handleShowProject(project)}>
                Show
              </button>
            </div>
          </article>
        ))}
      </div>

      <ProjectModal
        isOpen={isModalOpen}
        mode={activeProject ? 'edit' : 'create'}
        project={activeProject}
        submitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
    </div>
  );
}
