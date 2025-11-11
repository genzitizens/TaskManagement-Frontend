import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useProjects } from '../hooks/useProjects';
import ProjectModal from '../components/ProjectModal';
import DeleteProjectModal from '../components/DeleteProjectModal';
import type { ProjectCreateInput, ProjectRes } from '../types';

dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

export default function MenuPage() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isError,
    error,
    createProject,
    creating,
    updateProject,
    updating,
    deleteProject,
    deleting,
  } = useProjects();
  const projects = data?.content ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<ProjectRes | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRes | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const openDeleteModal = (project: ProjectRes) => {
    setDeleteError(null);
    setDeleteTarget(project);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleSubmit = async (input: ProjectCreateInput) => {
    if (activeProject) {
      await updateProject({
        id: activeProject.id,
        input: {
          ...input,
          updatedAt: activeProject.updatedAt,
        },
      });
    } else {
      await createProject(input);
    }
  };

  const handleDelete = async (project: ProjectRes) => {
    await deleteProject(project.id);
    closeModal();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleteError(null);
      await deleteProject(deleteTarget.id);
      closeDeleteModal();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const handleShowProject = (project: ProjectRes) => {
    navigate(`/projects/${project.id}`);
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
              <p className="menu-card-meta">
                Started {(() => {
                  // console.log('BEFORE - Project:', project.name, 'Raw startDate:', project.startDate, 'Type:', typeof project.startDate);
                  // Parse with specific DD-MM-YYYY format
                  const dayjsDate = dayjs(project.startDate, 'DD-MM-YYYY', true);
                  // console.log('AFTER - Dayjs object isValid:', dayjsDate.isValid(), 'Formatted result:', dayjsDate.format('D MMMM YYYY'));
                  return dayjsDate.format('D MMMM YYYY');
                })()}
                <span aria-hidden="true"> • </span>
                Updated {(() => {
                  // console.log('UPDATED - Project:', project.name, 'Raw updatedAt:', project.updatedAt, 'Type:', typeof project.updatedAt);
                  const dayjsDate = dayjs(project.updatedAt); // Use default parsing for ISO format
                  // console.log('UPDATED - Dayjs object isValid:', dayjsDate.isValid(), 'fromNow result:', dayjsDate.fromNow());
                  return dayjsDate.isValid() ? dayjsDate.fromNow() : 'Invalid date';
                })()}
              </p>
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
                View
              </button>
              <button type="button" className="button-danger" onClick={() => openDeleteModal(project)}>
                Delete
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
        onDelete={activeProject ? handleDelete : undefined}
        deleting={deleting}
        onClose={closeModal}
      />
      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        project={deleteTarget}
        submitting={deleting}
        error={deleteError}
        onCancel={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
