import { Player, RawMessage } from "@minecraft/server";
import {
  ActionFormData,
  ActionFormResponse,
  ModalFormData,
  ModalFormResponse,
} from "@minecraft/server-ui";

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
export function showForm(
  form: ActionFormData | ModalFormData,
  player: Player,
): Promise<ActionFormResponse | ModalFormResponse> {
  // @ts-expect-error wrong player type
  return form.show(player);
}
