import { handleApi } from "../../../_shared/api.js";

export function onRequest(context) {
  return handleApi(context);
}
