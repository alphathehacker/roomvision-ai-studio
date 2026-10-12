import { useEffect, useState } from 'react';
import { Trash2, Database, Info, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input, Field } from '../components/ui/input';
import { ConfirmDialog } from '../components/ui/dialog';
import { getBackendUrl, setBackendUrl, healthCheck } from '../services/api';
import { deleteAllProjects } from '../services/storage';
import { formatBytes } from '../utils/common';

interface SettingsProps {
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

export function Settings({ onToast }: SettingsProps) {
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl());
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [storageInfo, setStorageInfo] = useState<string>('Estimating…');

  useEffect(() => {
    let cancelled = false;
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage
        .estimate()
        .then((est) => {
          if (cancelled) return;
          const used = est.usage ?? 0;
          const quota = est.quota ?? 0;
          setStorageInfo(
            quota > 0
              ? `${formatBytes(used)} used of ~${formatBytes(quota)} available`
              : `${formatBytes(used)} used`,
          );
        })
        .catch(() => {
          if (!cancelled) setStorageInfo('Unavailable in this browser.');
        });
    } else {
      setStorageInfo('Storage estimation is not supported in this browser.');
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const saveUrl = () => {
    const trimmed = backendUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(trimmed)) {
      onToast('Backend URL must start with http:// or https://', 'error');
      return;
    }
    setBackendUrl(trimmed);
    setBackendUrlState(trimmed);
    onToast('Backend URL saved.');
  };

  const checkHealth = async () => {
    setChecking(true);
    setHealth(null);
    try {
      const res = await healthCheck();
      setHealth(`Reachable ✓${res.version ? ` (server v${res.version})` : ''}`);
    } catch (err) {
      setHealth(err instanceof Error ? err.message : 'Unreachable.');
    } finally {
      setChecking(false);
    }
  };

  const wipeAll = async () => {
    try {
      await deleteAllProjects();
      onToast('All local designs deleted.');
    } catch (err) {
      onToast(`Could not delete designs: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-charcoal">Settings</h1>

      <section className="mt-8 rounded-3xl border border-line bg-white p-6" aria-label="Backend connection">
        <h2 className="text-lg font-semibold text-charcoal">Backend connection</h2>
        <p className="text-sm text-charcoal-soft mt-1">
          The editor works fully without a backend. Set this only if you run the optional AI
          segmentation server.
        </p>
        <div className="mt-4 flex gap-2">
          <Field label="Backend URL" htmlFor="backend-url" className="flex-1">
            <Input
              id="backend-url"
              value={backendUrl}
              onChange={(e) => setBackendUrlState(e.target.value)}
              placeholder="http://localhost:5000"
              inputMode="url"
              spellCheck={false}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="primary" size="sm" onClick={saveUrl}>
            Save URL
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void checkHealth()} loading={checking}>
            {!checking && 'Test connection'}
            {checking && 'Testing…'}
          </Button>
        </div>
        {health && (
          <p className="mt-3 text-sm text-charcoal-soft" role="status">
            {health}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-white p-6" aria-label="Local storage">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-charcoal">
          <Database size={18} className="text-bronze" aria-hidden="true" /> Local storage
        </h2>
        <p className="text-sm text-charcoal-soft mt-1 flex items-center gap-2">
          {storageInfo === 'Estimating…' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {storageInfo}
        </p>
        <p className="text-sm text-charcoal-soft mt-2">
          Saved designs and photos live in this browser's IndexedDB. Deleting them here is permanent.
        </p>
        <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirmWipe(true)}>
          <Trash2 size={15} aria-hidden="true" /> Delete all local designs
        </Button>
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-white p-6" aria-label="About">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-charcoal">
          <Info size={18} className="text-moss" aria-hidden="true" /> About
        </h2>
        <dl className="mt-3 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-charcoal-soft">Product</dt>
          <dd className="text-charcoal font-medium">RoomVision AI Studio</dd>
          <dt className="text-charcoal-soft">Phase</dt>
          <dd className="text-charcoal">1 — functional foundation</dd>
          <dt className="text-charcoal-soft">Version</dt>
          <dd className="text-charcoal">v0.1.0</dd>
        </dl>
      </section>

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={() => void wipeAll()}
        title="Delete all local designs?"
        message="This permanently deletes every saved design and its photos from this browser. This cannot be undone."
        confirmLabel="Delete everything"
        destructive
      />
    </div>
  );
}
