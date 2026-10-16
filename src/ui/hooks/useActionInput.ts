import { useContext } from "react";
import { useRowMenu } from "../components/RowActions";
import { StoreContext } from "../store";
import { useInput } from "ink";

/** Section commands must not also consume the letters in custom Ctrl chords.
 * TextField and the shortcut recorder deliberately retain raw Ink input. */
export function useActionInput(handler: Parameters<typeof useInput>[0], options?: Parameters<typeof useInput>[1] & { allowDuringMenu?: boolean }) {
  const captureMode = useContext(StoreContext)?.captureMode;
  const { menu } = useRowMenu();
  useInput((input, key) => {
    if (!options?.allowDuringMenu && (menu || captureMode === "menu")) return;
    if (!key.ctrl && !key.meta) handler(input, key);
  }, options);
}
