import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, login } from '../utils/auth';

type LocationState = {
  from?: {
    pathname: string;
  };
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const redirectPath = state.from?.pathname ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated()) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const success = login(username.trim(), password);

    if (!success) {
      setError('Invalid username or password.');
      return;
    }

    setError('');
    navigate(redirectPath, { replace: true });
  };

  return (
    <div className="app-shell">
      <main className="app-main" style={{ maxWidth: '420px', margin: '0 auto', width: '100%' }}>
        <section className="card">
          <h1>Sign in</h1>
          <p>Use the admin credentials to continue.</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error ? <p className="error-message" role="alert">{error}</p> : null}
            <button type="submit">Log in</button>
          </form>
        </section>
      </main>
    </div>
  );
}
