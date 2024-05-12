import { ItemCustomComponent, Vector3 } from "@minecraft/server";
import { DynamicProperty } from "./dynamic_property";
import { forceLoadNetworksRule } from "./addon_rules";

export const wirelessInterfaceConnectionProperty = new DynamicProperty<Vector3>(
  "fluffyalien_asn:wireless_interface_connection",
);

export const wirelessInterfaceComponent: ItemCustomComponent = {
  onUse(e) {
    if (!e.itemStack) return;

    if (!forceLoadNetworksRule.get()) {
      e.source.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate:
              "fluffyalien_asn.message.wirelessInterface.forceLoadNetworksDisabled",
          },
        ],
      });
      return;
    }

    const link = wirelessInterfaceConnectionProperty.get(e.itemStack);

    if (!link) {
      e.source.sendMessage({
        rawtext: [
          {
            text: "§c",
          },
          {
            translate: "fluffyalien_asn.message.wirelessInterface.notLinked",
          },
        ],
      });
      return;
    }
  },
};
