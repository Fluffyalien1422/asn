import { BlockCustomComponent } from "@minecraft/server";

//TODO: waiting for [bedrock-energistics-core#64](https://github.com/Fluffyalien1422/bedrock-energistics-core/issues/64)
// we need to get all storage types to see what this drive is storing

// function showFluidDriveUi(
//   player: Player,
//   drive: Block,
// ): Promise<ActionFormResponse> {
//   const form = new ActionFormData();

//   form.title({
//     translate: "tile.fluffyalien_asn:fluid_drive.name",
//   });

//   form.body({
//     translate: "fluffyalien_asn.ui.storageDrive.body.storageUsed",
//     with: {
//       rawtext: [
//         {
//           text: "0",
//         },
//       ],
//     },
//   });

//   form.button({
//     translate: "fluffyalien_asn.ui.common.close",
//   });

//   return showForm(form, player);
// }

export const fluidDriveComponent: BlockCustomComponent = {};
