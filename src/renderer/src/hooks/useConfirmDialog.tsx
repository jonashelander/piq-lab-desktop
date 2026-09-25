import { useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface Options {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Returns:
 *   confirm(opts?) → Promise<boolean>  — show dialog, resolves true=confirmed false=cancelled
 *   dialogEl                           — render this somewhere in your JSX
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Options>({});
  const resolveRef = useRef<(value: boolean) => void>();

  const confirm = useCallback((options: Options = {}): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    setOpen(false);
    resolveRef.current?.(true);
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current?.(false);
  }

  const dialogEl = open ? (
    <ConfirmDialog
      title={opts.title ?? 'Unsaved changes'}
      message={opts.message ?? 'You have unsaved changes. Leave without saving?'}
      confirmLabel={opts.confirmLabel ?? 'Leave'}
      cancelLabel={opts.cancelLabel ?? 'Stay'}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialogEl };
}
