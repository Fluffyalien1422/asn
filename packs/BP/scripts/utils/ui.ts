import { Block, Entity, Player, RawMessage } from "@minecraft/server";
import {
  ActionFormData,
  ActionFormResponse,
  ModalFormData,
  ModalFormResponse,
} from "@minecraft/server-ui";
import { StorageNetwork } from "../storage_network";
import { forceCloseInventory } from "../storage_ui";
import { showEstablishNetworkError } from "../cable_network";

export function makeMessageUi(
  title: RawMessage,
  body: RawMessage,
): ActionFormData {
  const form = new ActionFormData();

  form.title(title);
  form.body(body);
  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return form;
}

export function makeErrorMessageUi(body: RawMessage): ActionFormData {
  return makeMessageUi(
    {
      translate: "fluffyalien_asn.ui.common.error",
    },
    body,
  );
}

export function showForm(
  form: ActionFormData,
  player: Player,
): Promise<ActionFormResponse>;
export function showForm(
  form: ModalFormData,
  player: Player,
): Promise<ModalFormResponse>;
/**
 * @deprecated
 */
export function showForm(
  form: ActionFormData | ModalFormData,
  player: Player,
): Promise<ActionFormResponse | ModalFormResponse> {
  return form.show(player);
}

export async function getNetworkOrShowError(
  block: Block,
  interfaceEntity: Entity,
  player: Player,
): Promise<StorageNetwork | undefined> {
  const networkResult = await StorageNetwork.getOrEstablishNetwork(block);
  if (!networkResult.success) {
    await forceCloseInventory(interfaceEntity);
    void showEstablishNetworkError(player, networkResult.error);

    return;
  }

  return networkResult.value;
}
