import { world } from "@minecraft/server";
import { fluidStorageExperimentRule } from "./addon_rules";
import { isBedrockEnergisticsCoreInWorld } from "bedrock-energistics-core-api";

world.beforeEvents.playerPlaceBlock.subscribe(
  (e) => {
    if (!fluidStorageExperimentRule.get(world)) {
      e.cancel = true;
      e.player.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate:
              "fluffyalien_asn.message.fluidStorage.fluidStorageExperimentDisabled",
          },
        ],
      });
      return;
    }

    if (
      e.permutationBeingPlaced.type.id === "fluffyalien_asn:fluid_interface" &&
      !isBedrockEnergisticsCoreInWorld()
    ) {
      e.cancel = true;
      e.player.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate: "fluffyalien_asn.message.fluidInterface.noBec",
          },
        ],
      });
      return;
    }
  },
  {
    blockTypes: [
      "fluffyalien_asn:fluid_interface",
      "fluffyalien_asn:fluid_drive",
      "fluffyalien_asn:fluid_import_bus",
    ],
  },
);
