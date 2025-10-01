import { FormEvent, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { z } from 'zod';
import { useProjects } from '../hooks/useProjects';

dayjs.extend(relativeTime);

const schema = z.object({
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

export default function ProjectsPage() {
  const { data, isLoading, isError, error, createProject, creating } = useProjects();
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);

  const projects = data?.content ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const result = schema.safeParse({
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
              <strong>{project.name}</strong>
              {project.description ? <p>{project.description}</p> : null}
              <p className="badge">Updated {dayjs(project.updatedAt).fromNow()}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
