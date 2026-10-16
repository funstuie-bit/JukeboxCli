import { act, createElement, Fragment, type ReactNode } from "react";
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
export async function renderReady(node: ReactNode, columns?: number) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    if (columns === undefined) view = render(node);
    else {
      view = render(createElement(Fragment));
      Object.defineProperty(view.stdout, "columns", {value:columns,configurable:true});
      view.rerender(node);
    }
  });
  return view;
}

export async function press(view: ReturnType<typeof render>, key: string) {
  await act(async () => { view.stdin.write(key); });
}

export { act };
