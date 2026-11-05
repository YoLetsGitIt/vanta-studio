'use client';

// The dashboard page is retired: Schedule is the start page, and the sidebar holds the
// month calendar and everything that needs action. Only the setup checklist stays here,
// for the Settings shortcut (?setup=1).
import { useEffect, useState } from 'react';
import StudioSetupChecklist from '@/components/StudioSetupChecklist';

export default function HomePage() {
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === '1') { setSetup(true); return; }
    window.location.replace(params.get('tour') === '1' ? '/dashboard/schedule?tour=1' : '/dashboard/schedule');
  }, []);
  if (!setup) return null;
  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 960, width: '100%' }}>
      <StudioSetupChecklist />
    </div>
  );
}
