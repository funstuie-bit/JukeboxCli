import { act, type ReactNode } from "react";
import { afterEach, beforeEach } from "vitest";
import { cleanup, render } from "ink-testing-library";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previous: boolean | undefined;
beforeEach(() => {
  previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => { cleanup(); });
  if (previous === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT;
  else environment.IS_REACT_ACT_ENVIRONMENT = previous;
});

/** A painted frame can precede useInput's passive effect on a new menu.
 * Flush React's work, not a guessed sleep, before sending the next key. */
export async function renderReady(node: ReactNode) {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(node); });
  return view;
}

export async function press(view: ReturnType<typeof render>, key: string) {
  await act(async () => { view.stdin.write(key); });
}

export { act };
