import * as admin from "firebase-admin";
import {serviceAccount} from "./constants/serviceAccount";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
  });
}

const db = admin.firestore();

const databaseURL = process.env.NEXT_PUBLIC_DATABASE_URL;

export {db, admin, serviceAccount, databaseURL};
