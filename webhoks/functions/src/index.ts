import * as functions from "firebase-functions";
import {updateLatestTransaction} from "./updateCreditTransaction";
import {validateHeader} from "./validateHeader";
const {
  error,
  log
} = require("firebase-functions/logger");


module.exports = {
  creditTransactionsWebHook: functions.https.onRequest(
      async (request, response) => {
        try {
          validateHeader(request, "creditTransactionsWebHook");
          const {op, data: {new:newRecord}} = request.body;
          log(request.body);
          if (op !== "INSERT") throw new Error("This route only supports inserts");
          await updateLatestTransaction(newRecord);
          response.status(200).send();
        } catch (err) {
          error(err);
          // @ts-ignore
          if (err?.message === "Unauthorized") {
            response.status(400).send();
          }
          response.status(500).send();
        }
      }
  ),
};

// https://credit-ui-git-user-transactions-3xcali-frontend.vercel.app/credit