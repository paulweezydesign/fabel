'use client';

import { useCallback, useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastState {
  readonly message: string;
  readonly variant: ToastVariant;
}

const TOAST_DURATION_MS = 4000;

export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ message, variant });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [toast]);

  return { toast, showToast, dismissToast };
};

export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss?: () => void }) {
  if (!toast) return null;

  return (
    <div
      className={`toast toast--${toast.variant}`}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {toast.message}
    </div>
  );
}
