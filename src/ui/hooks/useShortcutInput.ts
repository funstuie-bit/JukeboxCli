import { useInput, type Key } from "ink";
import { useStore } from "../store";
import { shortcutInput, type ShortcutScope } from "../shortcuts";
export function useShortcutInput(handler: (input: string, key: Key) => void, scope: ShortcutScope, active: boolean) {
  const { config, captureMode } = useStore();
  useInput((input, key) => {
    if (captureMode === "text") return;
    const translated = shortcutInput(input, key, config.keybindings, scope);
    if (translated && !translated[1].ctrl && !translated[1].meta) handler(...translated);
  }, { isActive: active });
}
