import { Player, RawMessage } from "@minecraft/server";
import {
  ActionFormData,
  ActionFormResponse,
  ModalFormData,
  ModalFormResponse,
} from "@minecraft/server-ui";

export function showForm<T extends ActionFormData | ModalFormData>(
  form: T,
  player: Player
): Promise<T extends ActionFormData ? ActionFormResponse : ModalFormResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  return form.show(player as any);
}

export function makeErrorMessageUi(body: RawMessage): ActionFormData {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.common.error",
      },
    ],
  });

  form.body(body);

  form.button({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.common.ok",
      },
    ],
  });

  return form;
}
