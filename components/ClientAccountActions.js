'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';

export default function ClientAccountActions({ email }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logOut() {
    setBusy(true);
    setError('');
    try {
      const { error } = await getSupabase().auth.signOut({ scope: 'local' });
      if (error) throw error;
      // Clear the previous client's form while retaining this studio's QR URL.
      window.location.reload();
    } catch {
      setError('Could not log out. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>Signed in as {email}</p>
        <Button variant="ghost" size="sm" loading={busy} loadingLabel="Logging out…" onClick={logOut} style={{ flexShrink: 0 }}>Log out</Button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: 8 }}>{error}</p>}
    </div>
  );
}
