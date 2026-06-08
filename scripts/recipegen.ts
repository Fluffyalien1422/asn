/**
 * Generates the packs/BP/scripts/generated/recipes.js file
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const OVERRIDES: Record<string, string> = {
  "minecraft:boat:4": "minecraft:acacia_boat",
  "minecraft:chest_boat:4": "minecraft:acacia_chest_boat",
  "minecraft:boat:7": "minecraft:bamboo_raft",
  "minecraft:chest_boat:7": "minecraft:bamboo_chest_raft",
  "minecraft:bamboo_planks:4": "minecraft:bamboo_planks",
};

//#region Types
type RecipeItem = [string, number];
interface RecipeData {
  input: RecipeItem[];
  count: number;
}
type Output = Record<string, RecipeData[]>;

interface VanillaItemRef {
  item: string;
  data?: number;
  count?: number;
}
interface VanillaRecipe {
  description: {
    identifier: string;
  };
  tags: string[];
  result: VanillaItemRef;
}
interface VanillaRecipeShapeless extends VanillaRecipe {
  ingredients: VanillaItemRef[];
}
interface VanillaRecipeShaped extends VanillaRecipe {
  pattern: string[];
  key: Record<string, VanillaItemRef>;
}
//#endregion Types

//#region Prepare
console.log("Preparing.");

const scriptsGeneratedDirPath = "packs/BP/scripts/generated";
if (!fs.existsSync(scriptsGeneratedDirPath)) {
  fs.mkdirSync(scriptsGeneratedDirPath);
}

const tmpDirPath = fs.mkdtempSync("recipegen_tmp");
//#endregion Prepare

//#region Download bedrock-samples
console.log("Downloading Mojang/bedrock-samples.");

execSync("git clone https://github.com/Mojang/bedrock-samples", {
  cwd: tmpDirPath,
});
//#endregion Download bedrock-samples

//#region Generate
console.log("Generating.");

const recipesPath = path.join(
  tmpDirPath,
  "bedrock-samples/behavior_pack/recipes",
);

// Maps the result item ID to the recipe data.
const output: Output = {};

function setRecipeData(item: string, data: RecipeData): void {
  if (!(item in output)) output[item] = [];
  output[item].push(data);
}

function hasValidTag(content: VanillaRecipe): boolean {
  return content.tags.includes("crafting_table");
}

function parseItemRef(ref: VanillaItemRef): RecipeItem {
  let item = ref.item;
  const data = ref.data ?? 0;
  if (data !== 0) {
    const override = `${item}:${data.toString()}`;
    if (override in OVERRIDES) {
      item = OVERRIDES[override];
    } else {
      console.warn(`No override found for '${override}'.`);
    }
  }

  return [item, ref.count ?? 1];
}

function parseShapeless(content: VanillaRecipeShapeless): void {
  if (!hasValidTag(content)) return;

  const ingredientsMap: Record<string, number> = {};
  for (const ingredientItemRef of content.ingredients) {
    const ingredient = parseItemRef(ingredientItemRef);
    ingredientsMap[ingredient[0]] =
      (ingredientsMap[ingredient[0]] ?? 0) + ingredient[1];
  }

  const result = parseItemRef(content.result);

  setRecipeData(result[0], {
    input: Object.entries(ingredientsMap),
    count: result[1],
  });
}

function parseShaped(content: VanillaRecipeShaped): void {
  if (!hasValidTag(content)) return;

  const ingredientsMap: Record<string, number> = {};
  for (const row of content.pattern) {
    for (const char of row) {
      if (!(char in content.key)) continue;
      const ingredientItemRef = content.key[char];
      const ingredient = parseItemRef(ingredientItemRef);
      ingredientsMap[ingredient[0]] =
        (ingredientsMap[ingredient[0]] ?? 0) + ingredient[1];
    }
  }

  const result = parseItemRef(content.result);

  setRecipeData(result[0], {
    input: Object.entries(ingredientsMap),
    count: result[1],
  });
}

for (const fileName of fs.readdirSync(recipesPath)) {
  const content = JSON.parse(
    fs.readFileSync(path.join(recipesPath, fileName), "utf8"),
  ) as object;

  if ("minecraft:recipe_shapeless" in content) {
    parseShapeless(
      content["minecraft:recipe_shapeless"] as VanillaRecipeShapeless,
    );
  } else if ("minecraft:recipe_shaped" in content) {
    parseShaped(content["minecraft:recipe_shaped"] as VanillaRecipeShaped);
  }
}

//#endregion Generate

//#region Finish up
console.log("Finishing up.");

fs.rmSync(tmpDirPath, { recursive: true });
fs.writeFileSync(
  path.join(scriptsGeneratedDirPath, "recipes.js"),
  `export default ${JSON.stringify(output)};`,
);
//#endregion Finish up

console.log("Done.");
