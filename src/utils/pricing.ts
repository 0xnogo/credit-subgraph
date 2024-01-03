/* eslint-disable prefer-const */
import {
  BigDecimal,
  Address,
  BigInt,
  log,
} from "@graphprotocol/graph-ts/index";
// WHITELIST - token where amounts should contribute to tracked volume and liquidity
import {
  WHITELIST,
  BIG_DECIMAL_ZERO,
  ADDRESS_ZERO,
  BIG_DECIMAL_ONE,
  WETH_ADDRESS,
  USDC_WETH_PAIR,
  DAI_WETH_PAIR,
  USDT_WETH_PAIR,
} from "const";
import { SwapPair, Token, Bundle } from "../../generated/schema";
import { convertTokenToDecimal, factoryContract, UNTRACKED_PAIRS } from "./helpers";
import { getToken } from "../entities";

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let daiPair = SwapPair.load(DAI_WETH_PAIR.toHexString()); // dai is token0
  let usdcPair = SwapPair.load(USDC_WETH_PAIR.toHexString()); // usdc is token0
  let usdtPair = SwapPair.load(USDT_WETH_PAIR.toHexString()); // usdt is token0

  log.info("ethPricePairInfo:\n dai: {}\n usdc: {}\n usdt: {}\n", [
    DAI_WETH_PAIR.toHexString(),
    USDC_WETH_PAIR.toHexString(),
    USDT_WETH_PAIR.toHexString(),
  ]);
  // all 3 have been created
  if (daiPair !== null && usdcPair !== null && usdtPair !== null) {
    let totalLiquidityETH = daiPair.reserve1
      .plus(usdcPair.reserve1)
      .plus(usdtPair.reserve1);
    let daiWeight = daiPair.reserve1.div(totalLiquidityETH);
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityETH);
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityETH);
    return daiPair.token0Price
      .times(daiWeight)
      .plus(usdcPair.token0Price.times(usdcWeight))
      .plus(usdtPair.token0Price.times(usdtWeight));
    // dai and USDC have been created
  } else if (daiPair !== null && usdcPair !== null) {
    let totalLiquidityETH = daiPair.reserve1.plus(usdcPair.reserve1);
    let daiWeight = daiPair.reserve1.div(totalLiquidityETH);
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityETH);
    return daiPair.token0Price
      .times(daiWeight)
      .plus(usdcPair.token0Price.times(usdcWeight));
    // USDC is the only pair so far
  } else if (usdcPair !== null) {
    if(usdcPair.token0===WETH_ADDRESS.toHexString()){
      return usdcPair.token1Price;
    }
    return usdcPair.token0Price;
  } else {
    return BIG_DECIMAL_ZERO;
  }
}
// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
// let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString("400000");
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString("0.00000001");

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString("0.00000001");

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS.toHexString()) {
    return BIG_DECIMAL_ONE;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(
      Address.fromString(token.id),
      Address.fromString(WHITELIST[i])
    );

    log.info("padd : {}", [pairAddress.toHexString()]);
    if (pairAddress.toHexString() != ADDRESS_ZERO.toHexString()) {
      let pair = SwapPair.load(pairAddress.toHexString()) as SwapPair;
      log.info("paddetails \n token0Price: {} \n token1Price: {} ", [
        pair.token0Price.toString(),
        pair.token1Price.toString(),
      ]);

      if (
        pair.token0 == token.id &&
        pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)
      ) {
        let token1 = Token.load(pair.token1) as Token;
        log.info("paddetails1 \n token1DerivedETH: {} ", [
          (token1.derivedETH as BigDecimal).toString(),
        ]);
        return pair.token1Price.times(token1.derivedETH as BigDecimal); // return token1 per our token * Eth per token 1
      }
      if (
        pair.token1 == token.id &&
        pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)
      ) {
        let token0 = Token.load(pair.token0) as Token;
        log.info("paddetails1 \n token0DerivedETH: {} ", [
          (token0.derivedETH as BigDecimal).toString(),
        ]);
        return pair.token0Price.times(token0.derivedETH as BigDecimal); // return token0 per our token * ETH per token 0
      }
    }
  }
  return BIG_DECIMAL_ZERO; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: SwapPair
): BigDecimal {
  let bundle = Bundle.load("1") as Bundle;
  let price0 = ((token0 as Token).derivedETH as BigDecimal).times(
    bundle.ethPrice
  );
  let price1 = ((token1 as Token).derivedETH as BigDecimal).times(
    bundle.ethPrice
  );

  // dont count tracked volume on these pairs - usually rebass tokens
  if (UNTRACKED_PAIRS.includes(pair.id)) {
    return BIG_DECIMAL_ZERO;
  }

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0);
    let reserve1USD = pair.reserve1.times(price1);
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return BIG_DECIMAL_ZERO;
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (
        reserve0USD
          .times(BigDecimal.fromString("2"))
          .lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return BIG_DECIMAL_ZERO;
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (
        reserve1USD
          .times(BigDecimal.fromString("2"))
          .lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return BIG_DECIMAL_ZERO;
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return BIG_DECIMAL_ZERO;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load("1") as Bundle;

  let price0 = (token0.derivedETH as BigDecimal).times(bundle.ethPrice);
  let price1 = (token1.derivedETH as BigDecimal).times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return BIG_DECIMAL_ZERO;
}

export function convertInttoUSD(value:BigInt,tokenAddress:string):BigDecimal{

  let bundle = Bundle.load("1");
  if(bundle!==null){
    const token = getToken(Address.fromString(tokenAddress));
    let rewardDebtConverted = convertTokenToDecimal(
      value,
      token.decimals
    );
    return rewardDebtConverted
      .times(token.derivedETH as BigDecimal)
      .times(bundle.ethPrice);

  }
  return BIG_DECIMAL_ZERO
} 

export function convertDecimalstoUSD(value:BigDecimal,tokenAddress:string):BigDecimal{
  let bundle = Bundle.load("1");
  if(bundle!==null){
    const token = Token.load(tokenAddress) as Token
    return value
      .times(token.derivedETH as BigDecimal)
      .times(bundle.ethPrice);

  }
  return BIG_DECIMAL_ZERO
} 