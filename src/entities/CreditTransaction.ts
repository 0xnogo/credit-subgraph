import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { CreditPair, CreditPairPool, CreditTransaction } from "../../generated/schema";
import { convertInttoUSD } from "../utils/pricing";
import { calculateAPR } from "../utils/credit";
import { getOrCreateUser } from "../utils/helpers";
import { BIG_INT_ONE, BIG_INT_ZERO, CONVENIENCE_ADDRESS, CREDIT_POSITION_ADDRESS } from "const";
import { CreditPosition } from "../../generated/CreditPosition/CreditPosition";
import { getCreditFactory } from "./CreditFactory";

export function createCreditTransaction(
    pair: CreditPair,
    pool: CreditPairPool,
    txHash: Bytes,
    block:ethereum.Block ,
    user: Address,
    type: string,
    assetAmount: BigInt,
    collateralAmount: BigInt
):void {
    const creditTransaction = new CreditTransaction(pool.id + "-" + pool.transactionCount.toString());
    creditTransaction.pool = pool.id;
    creditTransaction.blockNumber = block.number;
    creditTransaction.timestamp = block.timestamp;
    creditTransaction.txHash = txHash.toHexString();
    creditTransaction.type = type;
    // let owner = user;
    // if(user.equals(CONVENIENCE_ADDRESS)){
    //     //we have to get the user from the contract
    //     const lendingFactory = getCreditFactory();
    //     const cpContract = CreditPosition.bind(CREDIT_POSITION_ADDRESS);
    //     const latestId = 
    //     owner = cpContract.ownerOf(lendingFactory.lastCreditTokenId.plus(BIG_INT_ONE));
    // }
    getOrCreateUser(user);
    creditTransaction.user = user.toHexString();
    creditTransaction.assetAmount = assetAmount;
    creditTransaction.collateralAmount = collateralAmount;
    creditTransaction.assetValue = convertInttoUSD(assetAmount,pair.asset);
    creditTransaction.collateralValue = convertInttoUSD(collateralAmount,pair.collateral);
    creditTransaction.maxAPR = calculateAPR(pool.Y,pool.X);
    creditTransaction.X = pool.X;
    creditTransaction.Y = pool.Y;
    creditTransaction.Z = pool.Z;
    creditTransaction.index = pool.transactionCount;
    if(pool.transactionCount.gt(BIG_INT_ZERO)){
        creditTransaction.previousBlockNumber = (CreditTransaction.load(pool.id + "-" + pool.transactionCount.minus(BIG_INT_ONE).toString()) as CreditTransaction).blockNumber;
    }
    else{
        creditTransaction.previousBlockNumber = BIG_INT_ZERO;
    }
    creditTransaction.save()
}

// goldsky subgraph webhook create credit-test/1.0.3 --name transactions-webhook --entity credit_transaction --url https://us-central1-xcalibur-c38cf.cloudfunctions.net/creditTransactionsWebHook

// sudo goldsky subgraph webhook create credit-test/1.1.2 --name volatilis-transactions-webhook --entity credit_transaction --url https://us-central1-volatilis-credit-3ed6b.cloudfunctions.net/creditTransactionsWebHook

// goldsky subgraph deploy credit-test/1.0.5 --path build