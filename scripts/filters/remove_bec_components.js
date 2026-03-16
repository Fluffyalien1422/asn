import * as fs from "fs";
import * as path from "path";

for (const file of fs.readdirSync("BP/blocks", { withFileTypes: true })) {
  const filePath = path.join(file.parentPath, file.name);
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  delete content["minecraft:block"].components[
    "fluffyalien_energisticscore:machine"
  ];
  fs.writeFileSync(filePath, JSON.stringify(content));
}
