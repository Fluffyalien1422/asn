import { BlockCustomComponent, world } from "@minecraft/server";
import { getMachineStorage } from "bedrock-energistics-core-api";
import { useEnergyRule } from "./addon_rules";

export const storagePowerBankComponent: BlockCustomComponent = {
  onTick(e) {
    if (!useEnergyRule.get(world)) {
      return;
    }

    const poweredState = e.block.permutation.getState(
      "fluffyalien_asn:powered",
    );

    const hasEnergy = !!getMachineStorage(e.block, "energy");

    if (poweredState === hasEnergy) {
      return;
    }

    e.block.setPermutation(
      e.block.permutation.withState("fluffyalien_asn:powered", hasEnergy),
    );
  },
};
