# Codex Frontend

A minimal, fast front-end to manage **Projects**, **Tasks**, and **Notes** against the Task Management API.

> Backend OpenAPI summary: REST API at `http://localhost:8002` with resources `/api/projects`, `/api/tasks`, `/api/notes` (CRUD + pagination/sorting). Identifiers are UUIDs. Dates are ISO-8601 strings.

---

## Overview

Codex Frontend is a single-page application built with React, Vite, and TypeScript. It helps teams:

- **List & create Projects**
- **List, create, and delete Tasks** per Project
- **Capture contextual task notes** directly from the task form

The app integrates with the Task Management API. No authentication is assumed (add later if required).

---

## Quick Start

### Prerequisites

- Node.js 18+ (or use Docker, see below)
- Task Management API running locally at `http://localhost:8002`

### Install & Run locally

```bash
npm install
npm run dev
```

Visit the Vite dev server at [http://localhost:5173](http://localhost:5173).

### Build for production

```bash
npm run build
npm run preview
```

`npm run preview` serves the compiled assets using Vite's preview server on port 4173.

### Environment variables

Create a local `.env` by copying the sample:

```bash
cp .env.example .env.local
```

Available variables:

- `VITE_API_URL` (default: `http://localhost:8002`)
- `VITE_DEFAULT_PAGE_SIZE` (default: `20`)

---

## Docker support

### Development container

Use Docker Compose to run the Vite dev server with hot reload:

```bash
docker compose up --build
```

The container exposes port `5173`. Update `VITE_API_URL` to use `http://host.docker.internal:8002` if you run the API on your host machine (already configured in `docker-compose.yml`).

### Production image

Build a static production bundle served by Nginx:

```bash
# Build the image
DOCKER_BUILDKIT=1 docker build -t codex-frontend --target production .

# Run it
docker run -p 8080:80 codex-frontend
```

The Nginx image includes a `/healthz` endpoint for container health checks.

---

## Project structure

```
├── src
│   ├── api          # API client helpers and REST integrations
│   ├── components   # Layout and shared UI building blocks
│   ├── hooks        # React Query-powered data hooks
│   ├── routes       # React Router route components
│   ├── styles       # Global styles
│   └── types.ts     # Shared TypeScript models
├── docker           # Container configuration files
├── docker-compose.yml
├── Dockerfile
└── ReadMe.md
```

### Notable libraries

- **Vite + React + TypeScript** – SPA tooling
- **TanStack Query** – API data fetching/caching
- **React Router** – client routing
- **Zod** – form validation
- **Day.js** – lightweight date formatting
- **Vitest + Testing Library** – unit tests

---

## Feature highlights

### Projects

- Create projects with validation (name ≤ 160 chars, optional description ≤ 10,000 chars)
- List projects (newest first) with relative update timestamps

### Tasks

- Scope tasks to a selected project
- Create tasks with due dates, optional description, optional note, and activity flag
- Delete tasks inline with optimistic cache refresh
- Maintain a single note per task with create, update, and delete flows

---

## API client

All API calls share a thin wrapper around `fetch` that automatically applies the configured base URL and JSON headers. Error responses bubble up as `Error` objects for hooks to display inline messaging.

Pagination helpers honor `VITE_DEFAULT_PAGE_SIZE` and can be extended for sorting/filtering.

---

## Testing

Run unit tests with:

```bash
npm test
```

Vitest is configured with jsdom and Testing Library. Example tests live in `src/App.test.tsx`.

---

## Accessibility & UX

- Semantic HTML elements for forms and lists
- Focus on keyboard-friendly controls
- Inline validation messaging from Zod schemas

---

## Future enhancements

- Persist selected pagination/sort settings
- Surface richer reporting or history for task notes
- Add authentication and protected routes when the API supports it
- Replace inline styling with a component library or CSS framework if desired

---

**Maintainers**: Task Management Team · [support@example.com](mailto:support@example.com)
