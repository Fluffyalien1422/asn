import { RawMessage } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

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
