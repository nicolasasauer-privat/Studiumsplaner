import React, { useState, useEffect } from 'react';
import { BookOpen, UserPlus, LogIn, Eye, EyeOff, Trash2 } from 'lucide-react';

interface UserSelectionProps {
  onLogin: (username: string, token: string) => void;
}

type View = 'select' | 'create';

export const UserSelection: React.FC<UserSelectionProps> = ({ onLogin }) => {
  const [view, setView] = useState<View>('select');
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json() as Promise<string[]>)
      .then((data) => setUsers(data))
      .catch(() => setUsers([]));
  }, []);

  const handleUserSelect = async (username: string) => {
    setError('');
    setPassword('');
    setSelectedUser(username);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json() as { requiresPassword?: boolean; username?: string; token?: string };
      if (res.ok && data.token) {
        onLogin(username, data.token);
      } else if (res.status === 401 && data.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setError('Fehler beim Anmelden');
      }
    } catch {
      setError('Server nicht erreichbar');
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUser, password }),
      });
      const data = await res.json() as { username?: string; token?: string; error?: string };
      if (res.ok && data.token) {
        onLogin(selectedUser, data.token);
      } else {
        setError(data.error ?? 'Falsches Passwort');
      }
    } catch {
      setError('Server nicht erreichbar');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { username: newUsername.trim() };
      if (newPassword.length > 0) {
        body.password = newPassword;
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { username?: string; token?: string; error?: string };
      if (res.ok && data.token) {
        onLogin(newUsername.trim(), data.token);
      } else {
        setError(data.error ?? 'Fehler beim Erstellen');
      }
    } catch {
      setError('Server nicht erreichbar');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(deleteConfirmUser)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u !== deleteConfirmUser));
        setDeleteConfirmUser(null);
      } else {
        try {
          const data = await res.json() as { error?: string };
          setError(data.error ?? 'Löschen fehlgeschlagen');
        } catch {
          setError('Löschen fehlgeschlagen');
        }
        setDeleteConfirmUser(null);
      }
    } catch {
      setError('Server nicht erreichbar');
      setDeleteConfirmUser(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
            <BookOpen size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">StudiumsPlaner</h2>
            <p className="text-sm text-slate-400">Bitte wähle einen Benutzer</p>
          </div>
        </div>

        {view === 'select' && (
          <>
            {!requiresPassword ? (
              <>
                {users.length > 0 ? (
                  <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                    {users.map((u) => (
                      <div key={u} className="flex items-center gap-2">
                        <button
                          onClick={() => void handleUserSelect(u)}
                          className="flex-1 text-left px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-blue-500 text-white transition-colors flex items-center gap-2"
                        >
                          <LogIn size={16} className="text-blue-400 flex-shrink-0" />
                          <span className="truncate">{u}</span>
                        </button>
                        <button
                          onClick={() => { setDeleteConfirmUser(u); setError(''); }}
                          className="p-3 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                          title={`${u} löschen`}
                          aria-label={`${u} löschen`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm mb-4 text-center py-4">
                    Noch keine Benutzer vorhanden.
                  </p>
                )}

                {error && (
                  <p className="text-red-400 text-sm mb-3">{error}</p>
                )}

                <button
                  onClick={() => { setView('create'); setError(''); }}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <UserPlus size={18} />
                  Neuen Benutzer anlegen
                </button>
              </>
            ) : (
              <form onSubmit={(e) => void handlePasswordLogin(e)} className="space-y-4">
                <p className="text-slate-300 text-sm">
                  Passwort für <span className="font-semibold text-white">{selectedUser}</span>:
                </p>
                <div className="relative">
                  <input
                    className="input-field pr-10"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Passwort eingeben"
                    maxLength={128}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setRequiresPassword(false); setSelectedUser(''); setError(''); }}
                    className="btn-secondary flex-1"
                  >
                    Zurück
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={loading}>
                    {loading ? 'Prüfen…' : 'Anmelden'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {view === 'create' && (
          <form onSubmit={(e) => void handleCreateUser(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Benutzername</label>
              <input
                className="input-field"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="z.B. max"
                maxLength={50}
                pattern="[-a-zA-Z0-9_ ]+"
                title="Erlaubt: Buchstaben, Ziffern, Leerzeichen, _ und -"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Passwort <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leer lassen für kein Passwort"
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setView('select'); setError(''); }}
                className="btn-secondary flex-1"
              >
                Zurück
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? 'Erstellen…' : 'Erstellen & Anmelden'}
              </button>
            </div>
          </form>
        )}
      </div>

      {deleteConfirmUser && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Konto löschen?</h2>
            <p className="text-slate-300 text-sm mb-4">
              Soll das Konto <span className="font-semibold text-white">{deleteConfirmUser}</span> unwiderruflich
              gelöscht werden? Alle Daten gehen dabei verloren.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="btn-secondary flex-1"
                disabled={deleteLoading}
              >
                Abbrechen
              </button>
              <button
                onClick={() => void handleDeleteConfirm()}
                className="flex-1 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50"
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Löschen…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
