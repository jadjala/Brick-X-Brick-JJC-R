import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button, Field } from '@/components/brutalist';
import { nowPhtTime, phtIso } from '@/lib/format';
import type { DashRow } from '@/lib/dash';

// Proxy Clock In / Out time picker. Defaults to now (PHT). Client keeps it light;
// the server enforces G8/G12 + the 4h cross-midnight grace (gotcha #5) and any
// error surfaces as a toast.
export function TimePickerDialog({
  open,
  kind,
  row,
  onClose,
  onConfirm,
}: {
  open: boolean;
  kind: 'clock-in' | 'clock-out';
  row: DashRow | null;
  onClose: () => void;
  onConfirm: (isoTimestamp: string) => Promise<void>;
}) {
  const [time, setTime] = useState(nowPhtTime());
  const [busy, setBusy] = useState(false);

  // Reset the time each time a new dialog opens.
  const reset = (o: boolean) => {
    if (o) setTime(nowPhtTime());
    if (!o) onClose();
  };

  const submit = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await onConfirm(phtIso(row.work_date, time));
    } finally {
      setBusy(false);
    }
  };

  const title = kind === 'clock-in' ? 'Proxy Clock In' : 'Proxy Clock Out';

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {row && (
          <DialogDescription>
            {row.full_name} · {row.work_date}
          </DialogDescription>
        )}
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Time (PHT)" htmlFor="proxy-time">
            <input
              id="proxy-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 w-full border-2 border-ink bg-paper px-3 font-mono text-sm focus:outline-none focus:-translate-x-[2px] focus:-translate-y-[2px] focus:shadow-hard transition-transform"
            />
          </Field>
          <p className="font-mono text-[11px] leading-relaxed text-steel">
            Work hours 05:00–23:00 PHT. Cross-midnight clock-out allowed to 04:00 next day.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void submit()} disabled={busy}>
              {busy ? '[ Saving... ]' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
