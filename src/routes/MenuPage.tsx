import { useState, type SVGProps } from 'react';
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
      {/* Enhanced Header with gradient and better button */}
      <div className="menu-header" style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        borderRadius: '12px',
        color: 'white',
        marginBottom: '32px',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            color: 'white',
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 8px 0'
          }}>
            <DashboardIcon style={{ width: '32px', height: '32px' }} aria-hidden="true" />
            Dashboard
          </h2>
          <p style={{ 
            margin: 0,
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '16px'
          }}>
            {projects.length === 0 
              ? 'Create your first project to get started' 
              : `Managing ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
            }
          </p>
        </div>
        <button 
          type="button" 
          onClick={openCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'white',
            color: '#667eea',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
        >
          <PlusIcon style={{ width: '20px', height: '20px' }} aria-hidden="true" />
          New Project
        </button>
      </div>

      {isLoading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ fontSize: '16px', margin: 0 }}>Loading your projects...</p>
        </div>
      ) : null}
      
      {isError ? (
        <div style={{
          padding: '24px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b'
        }}>
          <p style={{ margin: 0 }}>
            ⚠️ {error instanceof Error ? error.message : 'Failed to load projects'}
          </p>
        </div>
      ) : null}
      
      {!isLoading && !isError && !projects.length ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: '#f9fafb',
          borderRadius: '12px',
          border: '2px dashed #d1d5db'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '20px' }}>No projects yet</h3>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280' }}>
            Click "New Project" to create your first project
          </p>
        </div>
      ) : null}

      <div className="menu-list" style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
        rowGap: '32px'
      }}>
        {projects.map((project) => (
          <div key={project.id} style={{ padding: '16px' }}>
            <article 
              className="menu-card"
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #e5e7eb',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.borderColor = '#667eea';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
            onClick={() => handleShowProject(project)}
          >
            <header style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  flexShrink: 0
                }} />
                <h3 style={{ 
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {project.name}
                </h3>
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CalendarIcon style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                  {dayjs(project.startDate, 'DD-MM-YYYY', true).format('D MMM YYYY')}
                </div>
                <span style={{ color: '#d1d5db' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ClockIcon style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                  {dayjs(project.updatedAt).isValid() ? dayjs(project.updatedAt).fromNow() : 'Invalid date'}
                </div>
              </div>
            </header>
            
            <div style={{ flex: 1, marginBottom: '16px' }}>
              {project.description ? (
                <p style={{ 
                  margin: 0,
                  fontSize: '14px',
                  color: '#6b7280',
                  lineHeight: '1.6',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {project.description}
                </p>
              ) : (
                <p style={{ 
                  margin: 0,
                  fontSize: '14px',
                  color: '#9ca3af',
                  fontStyle: 'italic'
                }}>
                  No description provided
                </p>
              )}
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              paddingTop: '16px',
              borderTop: '1px solid #f3f4f6'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowProject(project);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
              >
                <EyeIcon style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                View
              </button>
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(project);
                }}
                style={{
                  padding: '8px 12px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                aria-label="Edit project"
              >
                <PencilIcon style={{ width: '16px', height: '16px' }} aria-hidden="true" />
              </button>
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(project);
                }}
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                aria-label="Delete project"
              >
                <TrashIcon style={{ width: '16px', height: '16px' }} aria-hidden="true" />
              </button>
            </div>
          </article>
          </div>
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

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
    </svg>
  );
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
    </svg>
  );
}

function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
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
