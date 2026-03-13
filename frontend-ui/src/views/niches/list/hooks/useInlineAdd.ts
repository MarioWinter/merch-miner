import { useState, useCallback } from 'react';
import { useCreateNicheMutation } from '../../../../store/nicheSlice';

export interface UseInlineAddReturn {
  isActive: boolean;
  isCreating: boolean;
  error: string | null;
  activate: () => void;
  cancel: () => void;
  submit: (name: string) => Promise<void>;
}

export const useInlineAdd = (): UseInlineAddReturn => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNiche, { isLoading: isCreating }] = useCreateNicheMutation();

  const activate = useCallback(() => {
    setError(null);
    setIsActive(true);
  }, []);

  const cancel = useCallback(() => {
    setIsActive(false);
    setError(null);
  }, []);

  const submit = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Name is required');
        return;
      }
      try {
        setError(null);
        await createNiche({ name: trimmed }).unwrap();
        setIsActive(false);
      } catch {
        setError('Failed to create niche');
      }
    },
    [createNiche],
  );

  return { isActive, isCreating, error, activate, cancel, submit };
};
