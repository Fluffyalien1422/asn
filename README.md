# Advanced Storage Network

Advanced Storage Network finally fixes your storage problem. Build a storage network that can hold infinite items, automate it, access it wirelessly, expand it infinitely, and so much more.

## Configuration

Configure the add-on by editing `scripts/__config.js` in the behavior pack with any text editor.

Every option is optional and is documented with a comment in the file. Remove an option to use its default. If an option is missing or set to the wrong type, its default is used and a warning is logged to the content log — a mistake in this file will never crash the add-on.

## Bundling in Modpacks

### Crafting

All recipes that are craftable by the storage network are stored in `BP/scripts/generated/__recipes.js`. By default, this only includes vanilla and ASN recipes. If you are bundling this add-on in a modpack, you can use the recipe generator script in `scripts/recipegen.ts` to generate a new `__recipes.js` containing any recipes you want.
