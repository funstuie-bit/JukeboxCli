import ts from "typescript";

/** Parse JavaScript syntax, not words such as "import" in UI text. */
export function importedSpecifiers(source: string): Set<string> {
  const file = ts.createSourceFile("bundle.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const specifiers = new Set<string>();
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.add(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const spec = node.arguments[0];
      if (spec && ts.isStringLiteral(spec)) specifiers.add(spec.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}
