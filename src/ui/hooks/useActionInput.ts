import { useInput } from "ink";

/** Section commands must not also consume the letters in custom Ctrl chords.
 * TextField and the shortcut recorder deliberately retain raw Ink input. */
export function useActionInput(handler: Parameters<typeof useInput>[0], options?: Parameters<typeof useInput>[1]) {
  useInput((input, key) => {
    if (!key.ctrl && !key.meta) handler(input, key);
  }, options);
}
