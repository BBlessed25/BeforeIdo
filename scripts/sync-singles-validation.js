import { readFileSync, writeFileSync } from "node:fs";
const source = readFileSync(new URL("../src/lib/singles.js", import.meta.url), "utf8");
writeFileSync(
  new URL("../google-apps-script/SinglesValidation.gs", import.meta.url),
  "// Generated from src/lib/singles.js. Run npm run sync:sheets after editing validation.\n" +
    source.replace(/^export /gm, "")
);
