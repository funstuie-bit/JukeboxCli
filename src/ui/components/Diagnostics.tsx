import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { diagnosticReport, exportDiagnostics, redactLog } from "../../diagnostics/log";
import { useStore } from "../store";
import { COLOR } from "../theme";
import { displayPath } from "../../util/format";

export function Diagnostics({ focused }: { focused: boolean }) {
  const { listRows } = useStore();
  const [lines, setLines] = useState(["Loading diagnostics…"]);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [note, setNote] = useState("");
  const height = Math.max(1, listRows - 5);
  useEffect(() => {
    let active = true;
    void diagnosticReport().then(report => { if (active) { setLines(report.split("\n")); setOffset(0); } });
    return () => { active = false; };
  }, [refresh]);
  useInput((input, key) => {
    if (key.downArrow || key.pageDown) setOffset(v => Math.min(Math.max(0, lines.length - height), v + (key.pageDown ? height : 1)));
    if (key.upArrow || key.pageUp) setOffset(v => Math.max(0, v - (key.pageUp ? height : 1)));
    if (key.home) setOffset(0);
    if (key.end) setOffset(Math.max(0, lines.length - height));
    if (input === "R") setRefresh(v => v + 1);
    if (input === "E") void exportDiagnostics().then(file => setNote(`Saved: ${displayPath(file)}`)).catch(error => setNote(redactLog(String(error))));
  }, { isActive: focused });
  return <Box flexDirection="column">
    <Text color={COLOR.alt} wrap="truncate-end">↑↓/Pg scroll · R Refresh · E Export sanitised report</Text>
    <Text color={COLOR.muted} wrap="truncate-end">Review reports before sharing; no cookies or config files are attached.</Text>
    {lines.slice(offset, offset + height).map((line, i) => <Text key={offset + i} wrap="truncate-end">{line || " "}</Text>)}
    <Text color={COLOR.good} wrap="truncate-middle">{note || `${offset + 1}–${Math.min(lines.length, offset + height)} / ${lines.length}`}</Text>
  </Box>;
}
