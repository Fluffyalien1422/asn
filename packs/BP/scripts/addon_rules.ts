import { DynamicPropertyAccessor } from "./utils/dynamic_property";

export const forceLoadNetworksRule =
  DynamicPropertyAccessor.withDefault<boolean>(
    "fluffyalien_asn:rule_force_load_networks",
    true,
  );

export const useEnergyRule = DynamicPropertyAccessor.withDefault<boolean>(
  "fluffyalien_asn:rule_use_energy",
  false,
);

export const showRequestItemDialogRule =
  DynamicPropertyAccessor.withDefault<boolean>(
    "fluffyalien_asn:rule_show_request_item_dialog",
    false,
  );

export const wirelessInterfaceRangeRule =
  DynamicPropertyAccessor.withDefault<number>(
    "fluffyalien_asn:rule_wireless_interface_range",
    500,
  );

export const driveEnergyConsumptionRule =
  DynamicPropertyAccessor.withDefault<number>("driveEnergyConsumptionRule", 50);

export const wirelessInterfaceEnergyConsumptionRule =
  DynamicPropertyAccessor.withDefault<number>(
    "wirelessInterfaceEnergyConsumptionRule",
    10,
  );

export const fluidStorageExperimentRule =
  DynamicPropertyAccessor.withDefault<boolean>(
    "fluidStorageExperimentRule",
    false,
  );
