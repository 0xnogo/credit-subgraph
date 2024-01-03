import { ADDRESS_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from "const";
import { CreditPair, CreditPairPool, CreditPosition } from "../../generated/schema";
import { log } from "@graphprotocol/graph-ts";
import { createCreditPosition } from "../entities/CreditPosition";
import { getCreditFactory, getCreditPair, getCreditPairPool } from "../entities";
import { CreditPositionCreated,CreditPositionBurnt,Transfer } from "../../generated/CreditPositionManager/CreditPositionManager";

export function onTransfer(event:Transfer):void {

    log.info("onTransfer >> \n address: {}\nfrom: {}\nto: {}\ntokenId: {}", [
        event.address.toHexString(),
        event.params.from.toHexString(),
        event.params.to.toHexString(),
        event.params.tokenId.toString(),
    ]);
    //mints and burns are handled separately
    if(event.params.from.equals(ADDRESS_ZERO) || event.params.to.equals(ADDRESS_ZERO)) return;

    const creditPosition = CreditPosition.load(event.params.tokenId.toString()) as CreditPosition;

    creditPosition.owner = event.params.to.toHexString();

    creditPosition.save();
};

export function onCreditPositionCreated(event:CreditPositionCreated):void {
    const pair = getCreditPair(event.params.pair,event.block) as CreditPair;
    const pool = getCreditPairPool(event.params.pair,event.params.maturity,event.block) as CreditPairPool;
    //handle borrows in the borrow event handler
    if(event.params.positionType !== 2){
        const lendingFactory = getCreditFactory()
        const tokenId  = event.params.tokenId;
        createCreditPosition(pool,pair,event.params.recipient.toHexString(),event.params.positionType,tokenId.toString(),BIG_INT_ZERO,BIG_INT_ZERO)
        lendingFactory.lastCreditTokenId = tokenId;
        lendingFactory.save()
    }
};

export function onCreditPositionRemoved(event:CreditPositionBurnt):void {
    const creditPosition = CreditPosition.load(event.params.tokenId.toString()) as CreditPosition;
    creditPosition.owner = ADDRESS_ZERO.toHexString();
    creditPosition.save();
};