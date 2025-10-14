import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const { pathname } = useLocation();
  const isProjectDetailPage = pathname.startsWith('/projects/');

  return (
    <div className={`app-shell${isProjectDetailPage ? ' app-shell--wide' : ''}`}>
      <header className="app-header">
        <h1>ICT 302 Task Management</h1>
        <p className="app-tagline">Projects and tasks at a glance.</p>
      </header>
      <nav className="app-nav">
        <NavLink to="/" end>
          Menu
        </NavLink>
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
