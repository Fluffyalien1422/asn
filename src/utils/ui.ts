import { Player, RawMessage } from "@minecraft/server";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
import {
  TRANSLATION_COMMON_UI_ERROR,
  TRANSLATION_COMMON_UI_OK,
} from "../texts";

export function showForm(
  form: ActionFormData,
  player: Player
): Promise<ActionFormResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  return form.show(player as any);
}

export function makeErrorMessageUi(body: RawMessage): ActionFormData {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: TRANSLATION_COMMON_UI_ERROR,
      },
    ],
  });

  form.body(body);

  form.button({
    rawtext: [
      {
        translate: TRANSLATION_COMMON_UI_OK,
      },
    ],
  });

  return form;
}
