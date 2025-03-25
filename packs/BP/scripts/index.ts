import { world } from "@minecraft/server";
import "./custom_components";
import "./script_events";
import "./tutorial_book";
import "./wireless_interface";
import { useEnergyRule } from "./addon_rules";

world.afterEvents.worldLoad.subscribe(() => {
  if (!useEnergyRule.get(world)) return;
  useEnergyRule.set(world, false);
  world.sendMessage(
    "§c'useEnergy' has been temporarily disabled in ASN v2.15.x. It has been set to 'false'.",
  );
});
