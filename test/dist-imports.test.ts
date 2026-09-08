import { expect, it } from "vitest";
import { importedSpecifiers } from "../scripts/dist-imports";

it("checks actual imports without treating minified UI text as dependencies", () => {
  const source = `import React from "react";import "ink";
    const ui={label:"import",name:"settings",description:"from somewhere"};
    const lazy=import("execa"); const data=require("../package.json");
    export {x} from "string-width"; // import "not-real"
  `;
  expect([...importedSpecifiers(source)]).toEqual(["react", "ink", "execa", "../package.json", "string-width"]);
});
