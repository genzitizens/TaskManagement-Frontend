# Codex Frontend

A minimal, fast front‑end to manage **Projects**, **Tasks**, and **Notes** against the Task Management API.

> Backend OpenAPI summary: REST API at `http://localhost:8002` with resources `/api/projects`, `/api/tasks`, `/api/notes` (CRUD + pagination/sorting). Identifiers are UUIDs. Dates are ISO‑8601 strings.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Data Shapes](#data-shapes)
6. [API Client](#api-client)
7. [UI Routes](#ui-routes)
8. [Working with Pagination & Sorting](#working-with-pagination--sorting)
9. [Create/Update/Delete Flows](#createupdate-delete-flows)
10. [Error Handling](#error-handling)
11. [Date & Time Handling](#date--time-handling)
12. [Validation Rules](#validation-rules)
13. [Dev UX & Scripts](#dev-ux--scripts)
14. [Testing](#testing)
15. [Styling](#styling)
16. [Accessibility & i18n](#accessibility--i18n)
17. [Future Enhancements](#future-enhancements)

---

## Overview

Codex Frontend is a single‑page application that lets you:

* **List & create Projects**
* **List, create, update, and delete Tasks** per Project
* **List & create Notes** for either a Project *or* a Task (mutually exclusive)

The app speaks to the provided Task Management API. No authentication is assumed (add later if required).

## Tech Stack

* **React + Vite + TypeScript**
* **TanStack Query** for data fetching & caching
* **React Router** for client routing
* **Zod** for form validation
* **Day.js** for dates (lightweight)
* **TailwindCSS** for styling (optional; swap as desired)

> You can replace pieces (Redux Toolkit instead of TanStack Query, etc.) without changing the API surface.

## Quick Start

```bash
# 1) Create the app (if starting fresh)
npm create vite@latest codex-frontend -- --template react-ts
cd codex-frontend

# 2) Install deps
npm i @tanstack/react-query react-router-dom zod dayjs
# (optional) TailwindCSS
npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p

# 3) Configure env
cp .env.example .env.local
# Edit VITE_API_URL in .env.local (defaults to http://localhost:8002)

# 4) Run
npm run dev
```

### .env.example

```
VITE_API_URL=http://localhost:8002
VITE_DEFAULT_PAGE_SIZE=20
```

## Configuration

* **API Base URL**: `VITE_API_URL` (e.g., `http://localhost:8002`)
* **CORS**: Ensure the backend allows your dev origin (e.g., `http://localhost:5173`).
* **Pagination defaults**: `VITE_DEFAULT_PAGE_SIZE` controls page size for list views.

## Data Shapes

TypeScript models aligned to the OpenAPI schemas:

```ts
export interface ProjectRes {
  id: string; // uuid
  name: string;
  description?: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface TaskRes {
  id: string; // uuid
  projectId: string; // uuid
  title: string;
  description?: string;
  isActivity?: boolean;
  endAt: string; // ISO datetime
  createdAt: string;
  updatedAt: string;
}

export interface NoteRes {
  id: string; // uuid
  projectId?: string; // uuid
  taskId?: string; // uuid
  body: string;
  createdAt: string; // ISO datetime
}

export interface Page<T> {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // current page index (0-based)
  numberOfElements: number;
  content: T[];
  first: boolean;
  last: boolean;
  empty: boolean;
}
```

Input payloads (for forms):

```ts
export interface ProjectCreateReq { name: string; description?: string }
export type ProjectUpdateReq = Partial<ProjectCreateReq>;

export interface TaskCreateReq {
  projectId: string;
  title: string; // max 160
  description?: string; // max 10000
  isActivity?: boolean;
  endAt: string; // ISO datetime
}
export type TaskUpdateReq = Partial<Omit<TaskCreateReq, 'projectId'>>;

export interface NoteCreateReq {
  projectId?: string;
  taskId?: string;
  body: string; // max 20000
}
```

## API Client

A tiny wrapper over `fetch` with error normalization.

```ts
// src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8002';

export type HttpError = { status: number; message: string; details?: unknown };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let details: any = undefined;
    try { details = await res.json(); } catch {}
    const message = details?.message || res.statusText || 'Request failed';
    throw { status: res.status, message, details } as HttpError;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Projects
export const Projects = {
  list: (page=0, size=20, sort?: string[]) =>
    request<Page<ProjectRes>>(`/api/projects?page=${page}&size=${size}${sort?.length?`&${sort.map(s=>`sort=${encodeURIComponent(s)}`).join('&')}`:''}`),
  create: (payload: ProjectCreateReq) => request<ProjectRes>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }),
  get: (id: string) => request<ProjectRes>(`/api/projects/${id}`),
  update: (id: string, payload: ProjectUpdateReq) => request<ProjectRes>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
};

// Tasks
export const Tasks = {
  listByProject: (projectId: string, page=0, size=20, sort?: string[]) =>
    request<Page<TaskRes>>(`/api/tasks?projectId=${projectId}&page=${page}&size=${size}${sort?.length?`&${sort.map(s=>`sort=${encodeURIComponent(s)}`).join('&')}`:''}`),
  create: (payload: TaskCreateReq) => request<TaskRes>('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  get: (id: string) => request<TaskRes>(`/api/tasks/${id}`),
  update: (id: string, payload: TaskUpdateReq) => request<TaskRes>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
};

// Notes
export const Notes = {
  list: (args: { projectId?: string; taskId?: string; page?: number; size?: number; sort?: string[] }) => {
    const { projectId, taskId, page=0, size=20, sort } = args;
    const qs = new URLSearchParams();
    if (projectId) qs.set('projectId', projectId);
    if (taskId) qs.set('taskId', taskId);
    qs.set('page', String(page));
    qs.set('size', String(size));
    sort?.forEach(s => qs.append('sort', s));
    return request<Page<NoteRes>>(`/api/notes?${qs.toString()}`);
  },
  create: (payload: NoteCreateReq) => request<NoteRes>('/api/notes', { method: 'POST', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/api/notes/${id}`, { method: 'DELETE' }),
};
```

### React Query usage example

```tsx
// src/features/projects/ProjectList.tsx
import { useQuery } from '@tanstack/react-query';
import { Projects } from '@/lib/api';

export function ProjectList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', 0, 20],
    queryFn: () => Projects.list(0, Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 20, ['name,asc'])
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error loading projects</p>;

  return (
    <ul>
      {data!.content.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

## UI Routes

* `/projects` – list & create projects
* `/projects/:projectId` – project details, tasks list, add task, notes (project‑scoped)
* `/tasks/:taskId` – task details & notes (task‑scoped)

> Notes are associated with **either** a project **or** a task, never both in one request.

## Working with Pagination & Sorting

All list endpoints support:

* `page` (0‑based), `size` (>=1)
* `sort` in the form `property,(asc|desc)`; multiple `sort` params are allowed

Pagination helper:

```ts
export function toPageParams(pageIndex: number, pageSize: number, sort?: string[]) {
  const qs = new URLSearchParams({ page: String(pageIndex), size: String(pageSize) });
  sort?.forEach(s => qs.append('sort', s));
  return qs.toString();
}
```

## Create/Update/Delete Flows

**Create Project** → POST `/api/projects` with `{ name, description? }` → navigate to `/projects/:id`.

**Create Task** → POST `/api/tasks` with `{ projectId, title, endAt, description?, isActivity? }`.

**Update Task/Project** → PATCH resource by id with fields to change.

**Delete** → issue `DELETE` and optimistically update the UI; on 404, refetch.

**Notes** → POST `/api/notes` with `{ body, projectId? | taskId? }`. Exactly one of `projectId` or `taskId` must be provided.

## Error Handling

* Show a toast/banner with normalized error message and optional details from server.
* Map common statuses:

  * **400** Validation failure → highlight fields
  * **404** Not found → show context message (“Project not found”)
  * **201/204** success → optimistic cache updates via React Query

## Date & Time Handling

* API uses **ISO 8601** strings (e.g., `2025-10-01T12:30:00Z`).
* Prefer storing as strings in state; format at the edge using Day.js.
* When creating tasks, convert local picker value to ISO string.

```ts
import dayjs from 'dayjs';
const iso = dayjs(localDateTime).toISOString();
```

## Validation Rules

* **Project**: `name` ≤ 160 chars; `description` ≤ 10,000 chars
* **Task**: `title` ≤ 160; `description` ≤ 10,000; `endAt` required
* **Note**: `body` ≤ 20,000; exactly one of `projectId` or `taskId` required

Example Zod schemas:

```ts
import { z } from 'zod';

export const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(10000).optional(),
});

export const TaskCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(160),
  description: z.string().max(10000).optional(),
  isActivity: z.boolean().optional(),
  endAt: z.string().datetime(),
});

export const NoteCreateSchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  body: z.string().min(1).max(20000),
}).refine(v => Boolean(v.projectId) !== Boolean(v.taskId), {
  message: 'Provide either projectId or taskId (not both).',
  path: ['projectId','taskId']
});
```

## Dev UX & Scripts

Add NPM scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest"
  }
}
```

## Testing

* **Unit**: Vitest + React Testing Library
* **Integration**: mock `fetch` or use MSW to simulate API
* **Contract**: keep TS models in sync with OpenAPI (consider `openapi-typescript` to generate types)

## Styling

* Tailwind utility classes for speed; components can be extracted as needed.
* Keep layout responsive; prefer system fonts.

## Accessibility & i18n

* Ensure forms have accessible labels and error messages.
* Use semantic HTML landmarks.
* Abstract copy into a simple dictionary if you plan to localize later.

## Future Enhancements

* Auth (JWT/OAuth) & protected routes
* Server‑side filtering/search for tasks
* Infinite scroll for lists
* Bulk edits & batch actions
* Markdown support in notes
* Optimistic updates with offline cache

---

### Handy cURL Examples

```bash
# List projects (page 0, size 20, sort by name asc)
curl "${VITE_API_URL:-http://localhost:8002}/api/projects?page=0&size=20&sort=name,asc"

# Create project
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo","description":"Sample"}' \
  "${VITE_API_URL:-http://localhost:8002}/api/projects"

# List tasks by project
curl "${VITE_API_URL:-http://localhost:8002}/api/tasks?projectId=<PROJECT_UUID>&page=0&size=20"

# Create task
curl -X POST -H 'Content-Type: application/json' \
  -d '{"projectId":"<PROJECT_UUID>","title":"Finish UI","endAt":"2025-10-01T12:00:00Z"}' \
  "${VITE_API_URL:-http://localhost:8002}/api/tasks"

# Create note (task‑scoped)
curl -X POST -H 'Content-Type: application/json' \
  -d '{"taskId":"<TASK_UUID>","body":"Remember to write tests"}' \
  "${VITE_API_URL:-http://localhost:8002}/api/notes"
```

---

**Maintainers**: Task Management Team · [support@example.com](mailto:support@example.com)

