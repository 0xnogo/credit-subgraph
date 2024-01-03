import * as functions from "firebase-functions";
import secrets from "../constants/secrets.json";

export function validateHeader(request:functions.https.Request, functionName:string) {
  const header = request.header("goldsky-webhook-secret");
  if (((secrets as Record<string, string>)[functionName]) !== header) {
    throw new Error("Unauthorized");
  }
}
