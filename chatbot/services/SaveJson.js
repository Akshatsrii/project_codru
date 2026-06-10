import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename =
   fileURLToPath(import.meta.url);

const __dirname =
   path.dirname(__filename);
export default function saveJson(data) {

    // Create filename
    const filename =
      data.url
      .replace(/https?:\/\//, "")
      .replace(/[\/:?&=]/g, "_");

    const filepath = path.join(
        __dirname,
        "../data/",
        `${filename}.json`
    );

    fs.writeFileSync(
        filepath,
        JSON.stringify(data, null, 2)
    );

    console.log("Saved:", filepath);
}

