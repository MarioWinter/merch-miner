import { useCallback, useEffect, useRef } from 'react';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseEmojiPickerParams {
  /** Called when the user selects an emoji via the OS picker or paste */
  onEmojiSelected: (emoji: string) => void;
}

interface UseEmojiPickerReturn {
  /** Focus a hidden input to trigger the OS emoji keyboard */
  openPicker: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

/**
 * Manages a hidden <input> element that, when focused, allows the user
 * to insert an emoji via the OS emoji picker (Cmd+Ctrl+Space on Mac,
 * Win+. on Windows) or by pasting.
 *
 * On `input` event the emoji character is extracted and forwarded via
 * the `onEmojiSelected` callback.
 */
const useEmojiPicker = ({
  onEmojiSelected,
}: UseEmojiPickerParams): UseEmojiPickerReturn => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const callbackRef = useRef(onEmojiSelected);

  // Keep callback ref in sync
  useEffect(() => {
    callbackRef.current = onEmojiSelected;
  }, [onEmojiSelected]);

  // Create the hidden input once and append to <body>
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    const handleInput = () => {
      const value = input.value.trim();
      if (value) {
        callbackRef.current(value);
      }
      // Clear for next use
      input.value = '';
    };

    input.addEventListener('input', handleInput);
    document.body.appendChild(input);
    inputRef.current = input;

    return () => {
      input.removeEventListener('input', handleInput);
      input.remove();
      inputRef.current = null;
    };
  }, []);

  const openPicker = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    // Clear previous value
    input.value = '';
    input.focus();
  }, []);

  return { openPicker };
};

export default useEmojiPicker;
