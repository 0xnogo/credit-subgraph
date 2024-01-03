/* eslint-disable prefer-const */
import { log } from "@graphprotocol/graph-ts";
import { SWAP_FACTORY_ADDRESS, BIG_DECIMAL_ZERO, BIG_INT_ZERO } from "const";

import { PairCreated } from "../../generated/SwapFactory/SwapFactory";
import { Bundle, SwapPair, Token, SwapFactory } from "../../generated/schema";
import { SwapPair as PairTemplate } from "../../generated/templates";
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
} from "../utils/helpers";

// @TODO: remove this once testnet cycle 3 ends
const blacklistedPairs: string[] = [
  "0x5584d375171b44bd99af5c6678f69768bbee26e5",
  "0x9944b4c7e784933d7bf3dd0202278ce7e06fb518",
];

export function handleNewPair(event: PairCreated): void {
  log.info("handleNewPair:\n token0: {}\n token1: {}\n pair: {}\n", [
    event.params.token0.toHexString(),
    event.params.token1.toHexString(),
    event.params.pair.toHexString(),
  ]);
  if (blacklistedPairs.includes(event.params.pair.toHexString())) return;

  // load factory (create if first exchange)
  let factory = SwapFactory.load(SWAP_FACTORY_ADDRESS.toHexString());
  if (factory === null) {
    factory = new SwapFactory(SWAP_FACTORY_ADDRESS.toHexString());
    factory.pairCount = 0;
    factory.totalVolumeETH = BIG_DECIMAL_ZERO;
    factory.totalLiquidityETH = BIG_DECIMAL_ZERO;
    factory.totalVolumeUSD = BIG_DECIMAL_ZERO;
    factory.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    factory.totalLiquidityUSD = BIG_DECIMAL_ZERO;
    factory.txCount = BIG_INT_ZERO;

    // create new bundle
    let bundle = new Bundle("1");
    bundle.ethPrice = BIG_DECIMAL_ZERO;
    bundle.save();
  }
  factory.pairCount = factory.pairCount + 1;
  factory.save();

  // create the tokens
  let token0 = Token.load(event.params.token0.toHexString());
  let token1 = Token.load(event.params.token1.toHexString());

  // fetch info if null
  if (token0 === null) {
    token0 = new Token(event.params.token0.toHexString());
    token0.symbol = fetchTokenSymbol(event.params.token0);
    token0.name = fetchTokenName(event.params.token0);
    token0.totalSupply = fetchTokenTotalSupply(event.params.token0);
    let decimals = fetchTokenDecimals(event.params.token0);

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      log.debug("mybug the decimal on token 0 was null", []);
      return;
    }

    token0.decimals = decimals;
    token0.derivedETH = BIG_DECIMAL_ZERO;
    token0.tradeVolume = BIG_DECIMAL_ZERO;
    token0.tradeVolumeUSD = BIG_DECIMAL_ZERO;
    token0.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    token0.totalLiquidity = BIG_DECIMAL_ZERO;
    // token0.allPairs = []
    token0.txCount = BIG_INT_ZERO;
  }

  // fetch info if null
  if (token1 === null) {
    token1 = new Token(event.params.token1.toHexString());
    token1.symbol = fetchTokenSymbol(event.params.token1);
    token1.name = fetchTokenName(event.params.token1);
    token1.totalSupply = fetchTokenTotalSupply(event.params.token1);
    let decimals = fetchTokenDecimals(event.params.token1);

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      return;
    }
    token1.decimals = decimals;
    token1.derivedETH = BIG_DECIMAL_ZERO;
    token1.tradeVolume = BIG_DECIMAL_ZERO;
    token1.tradeVolumeUSD = BIG_DECIMAL_ZERO;
    token1.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    token1.totalLiquidity = BIG_DECIMAL_ZERO;
    token1.txCount = BIG_INT_ZERO;
  }

  let pair = new SwapPair(event.params.pair.toHexString()) as SwapPair;
  pair.token0 = token0.id;
  pair.token1 = token1.id;
  pair.liquidityProviderCount = BIG_INT_ZERO;
  pair.createdAtTimestamp = event.block.timestamp;
  pair.createdAtBlockNumber = event.block.number;
  pair.txCount = BIG_INT_ZERO;
  pair.reserve0 = BIG_DECIMAL_ZERO;
  pair.reserve1 = BIG_DECIMAL_ZERO;
  pair.trackedReserveETH = BIG_DECIMAL_ZERO;
  pair.reserveETH = BIG_DECIMAL_ZERO;
  pair.reserveUSD = BIG_DECIMAL_ZERO;
  pair.totalSupply = BIG_DECIMAL_ZERO;
  pair.volumeToken0 = BIG_DECIMAL_ZERO;
  pair.volumeToken1 = BIG_DECIMAL_ZERO;
  pair.volumeUSD = BIG_DECIMAL_ZERO;
  pair.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
  pair.token0Price = BIG_DECIMAL_ZERO;
  pair.token1Price = BIG_DECIMAL_ZERO;

  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair);

  // save updated values
  token0.save();
  token1.save();
  pair.save();
  factory.save();
}
