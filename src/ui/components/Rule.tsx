import { Text } from "ink";
import { usePalette } from "../palette";
import { RULE } from "../theme";

/** A horizontal divider line in the muted rule gray. */
export function Rule({ width }: { width: number }) {
  const RULE = usePalette().muted;
  return (
    <Text color={RULE}>
      {"─".repeat(Math.max(1, width))}
    </Text>
  );
}
