# Advanced Storage Network

Advanced Storage Network finally fixes your storage problem. Build a storage network that can hold infinite items, automate it, access it wirelessly, expand it infinitely, and so much more.

## Configuration

Configure the add-on by editing `BP/scripts/__config.js` in the behavior pack with any text editor. Changes take effect the next time the world is loaded.

Every option is optional and is documented with a comment in the file. Remove an option to use its default. If an option is missing or set to the wrong type, its default is used and a warning is logged to the content log — a mistake in this file will never crash the add-on.

The available options are:

- `giveTutorialBookOnSpawn` — give players the tutorial book the first time they spawn.
- `customCommandNamespace` — the namespace for the add-on's custom commands, e.g. `fluffyalien_asn` makes `/fluffyalien_asn:asnrule`. Only change this when bundling in a modpack, as a single add-on cannot use multiple custom command namespaces.
- `rules` — the `default` value and `lock` state for each add-on rule. Setting a rule's `lock` to `true` fixes it at its default and prevents players from changing it in-game with the rule command.

## Bundling in Modpacks

### Crafting

All recipes that are craftable by the storage network are stored in `BP/scripts/generated/__recipes.js`. By default, this only includes vanilla and ASN recipes. If you are bundling this add-on in a modpack, you can use the recipe generator script in `scripts/recipegen.ts` to generate a new `__recipes.js` containing any recipes you want.

### Custom Commands

Minecraft only allows one custom command namespace per add-on. If you combine ASN with other add-ons into a single add-on, all of their custom commands must therefore share one namespace. Set the `customCommandNamespace` option (see [Configuration](#configuration)) so ASN registers its commands under that shared namespace instead of its own.
