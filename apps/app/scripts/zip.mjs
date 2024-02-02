import { createReadStream, createWriteStream } from "fs";
import JSZip from "jszip";
import { join } from "path";
import { pipeline } from "stream/promises";
const assets = ["main.js", "styles.css", "manifest.json"];
const zip = new JSZip();
for (const filename of assets) {
  zip.file(filename, createReadStream(join("dist", filename)));
}
await pipeline(
  zip.generateNodeStream({ type: "nodebuffer", streamFiles: true }),
  createWriteStream(join("dist", "media-extended.zip")),
);
console.log("build.zip written.");
