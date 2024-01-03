import {db} from "../db";
import {CreditTransaction} from "../../types";

export const updateLatestTransaction = async (currentTransaction:CreditTransaction) => {
  await db.doc(`latest-transaction/${currentTransaction.pool}`).set({
    ...currentTransaction,
  }, {
    merge: true,
  });
};
