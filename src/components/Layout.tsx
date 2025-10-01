import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Codex Task Management</h1>
        <p className="app-tagline">Projects, tasks, and notes at a glance.</p>
      </header>
      <nav className="app-nav">
        <NavLink to="/" end>
          Projects
        </NavLink>
        <NavLink to="/tasks">Tasks</NavLink>
        <NavLink to="/notes">Notes</NavLink>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <small>API base: {import.meta.env.VITE_API_URL ?? 'http://localhost:8002'}</small>
      </footer>
    </div>
  );
}
