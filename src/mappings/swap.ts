/* eslint-disable prefer-const */

import {
  BigInt,
  log,
  BigDecimal,
  store,
  Address,
} from "@graphprotocol/graph-ts";
import {
  SWAP_FACTORY_ADDRESS,
  BIG_DECIMAL_ZERO,
  ADDRESS_ZERO,
  BIG_INT_18,
  BIG_INT_ONE,
  WETH_ADDRESS,
  BIG_INT_ZERO,
} from "const";

import {
  SwapPair,
  Token,
  SwapFactory,
  SwapTransaction,
  SwapMint as MintEvent,
  SwapBurn as BurnEvent,
  Swap as SwapEvent,
  Bundle,
} from "../../generated/schema";
import {
  SwapPair as SwapPairContract,
  Mint,
  Burn,
  Swap,
  Transfer,
  Sync,
} from "../../generated/templates/SwapPair/SwapPair";
import {
  updatePairDayData,
  updateTokenDayData,
  updateUniswapDayData,
  updatePairHourData,
} from "../entities/DayUpdates";
import {
  getEthPriceInUSD,
  findEthPerToken,
  getTrackedVolumeUSD,
  getTrackedLiquidityUSD,
} from "../utils/pricing";
import {
  convertTokenToDecimal,
  getOrCreateUser,
  createLiquidityPosition,
  createLiquiditySnapshot,
} from "../utils/helpers";

function isCompleteMint(mintId: string): boolean {
  return (MintEvent.load(mintId) as MintEvent).sender !== null; // sufficient checks
}

export function handleTransfer(event: Transfer): void {
  // ignore initial transfers for first adds
  if (
    event.params.to.toHexString() == ADDRESS_ZERO.toHexString() &&
    event.params.value.equals(BigInt.fromI32(1000))
  ) {
    return;
  }

  let factory = SwapFactory.load(
    SWAP_FACTORY_ADDRESS.toHexString()
  ) as SwapFactory;
  let transactionHash = event.transaction.hash.toHexString();

  // user stats
  let from = event.params.from;
  getOrCreateUser(from);
  let to = event.params.to;
  getOrCreateUser(to);

  // get pair and load contract
  let pair = SwapPair.load(event.address.toHexString()) as SwapPair;
  let pairContract = SwapPairContract.bind(event.address);

  // liquidity token amount being transfered
  let value = convertTokenToDecimal(event.params.value, BIG_INT_18);

  // get or create transaction
  let transaction = SwapTransaction.load(transactionHash);
  if (transaction === null) {
    transaction = new SwapTransaction(transactionHash);
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.burns = [];
    transaction.swaps = [];
  }

  // mints
  let mints = transaction.mints;
  if (from.toHexString() == ADDRESS_ZERO.toHexString()) {
    // update total supply
    pair.totalSupply = pair.totalSupply.plus(value);
    pair.save();

    // create new mint if no mints so far or if last one is done already
    if (mints.length === 0 || isCompleteMint(mints[mints.length - 1])) {
      let mint = new MintEvent(
        event.transaction.hash
          .toHexString()
          .concat("-")
          .concat(BigInt.fromI32(mints.length).toString())
      );
      mint.transaction = transaction.id;
      mint.pair = pair.id;
      mint.to = to;
      mint.liquidity = value;
      mint.timestamp = transaction.timestamp;
      mint.transaction = transaction.id;
      mint.save();

      // update mints in transaction
      transaction.mints = mints.concat([mint.id]);

      // save entities
      transaction.save();
      factory.save();
    }
  }

  // case where direct send first on ETH withdrawls
  if (event.params.to.toHexString() == pair.id) {
    let burns = transaction.burns;
    let burn = new BurnEvent(
      event.transaction.hash
        .toHexString()
        .concat("-")
        .concat(BigInt.fromI32(burns.length).toString())
    );
    burn.transaction = transaction.id;
    burn.pair = pair.id;
    burn.liquidity = value;
    burn.timestamp = transaction.timestamp;
    burn.to = event.params.to;
    burn.sender = event.params.from;
    burn.needsComplete = true;
    burn.transaction = transaction.id;
    burn.save();

    // TODO: Consider using .concat() for handling array updates to protect
    // against unintended side effects for other code paths.
    burns.push(burn.id);
    transaction.burns = burns;
    transaction.save();
  }

  // burn
  if (
    event.params.to.toHexString() == ADDRESS_ZERO.toHexString() &&
    event.params.from.toHexString() == pair.id
  ) {
    pair.totalSupply = pair.totalSupply.minus(value);
    pair.save();

    // this is a new instance of a logical burn
    let burns = transaction.burns;
    let burn: BurnEvent;
    if (burns.length > 0) {
      let currentBurn = BurnEvent.load(burns[burns.length - 1]);
      if (currentBurn && currentBurn.needsComplete) {
        burn = currentBurn as BurnEvent;
      } else {
        burn = new BurnEvent(
          event.transaction.hash
            .toHexString()
            .concat("-")
            .concat(BigInt.fromI32(burns.length).toString())
        );
        burn.transaction = transaction.id;
        burn.needsComplete = false;
        burn.pair = pair.id;
        burn.liquidity = value;
        burn.transaction = transaction.id;
        burn.timestamp = transaction.timestamp;
      }
    } else {
      burn = new BurnEvent(
        event.transaction.hash
          .toHexString()
          .concat("-")
          .concat(BigInt.fromI32(burns.length).toString())
      );
      burn.transaction = transaction.id;
      burn.needsComplete = false;
      burn.pair = pair.id;
      burn.liquidity = value;
      burn.transaction = transaction.id;
      burn.timestamp = transaction.timestamp;
    }

    // if this logical burn included a fee mint, account for this
    if (mints.length !== 0 && !isCompleteMint(mints[mints.length - 1])) {
      let mint = MintEvent.load(mints[mints.length - 1]);
      if (mint) {
        burn.feeTo = mint.to;
        burn.feeLiquidity = mint.liquidity;
      }

      // remove the logical mint
      store.remove("Mint", mints[mints.length - 1]);
      // update the transaction

      // TODO: Consider using .slice().pop() to protect against unintended
      // side effects for other code paths.
      mints.pop();
      transaction.mints = mints;
      transaction.save();
    }
    burn.save();
    // if accessing last one, replace it
    if (burn.needsComplete) {
      // TODO: Consider using .slice(0, -1).concat() to protect against
      // unintended side effects for other code paths.
      burns[burns.length - 1] = burn.id;
    }
    // else add new one
    else {
      // TODO: Consider using .concat() for handling array updates to protect
      // against unintended side effects for other code paths.
      burns.push(burn.id);
    }
    transaction.burns = burns;
    transaction.save();
  }

  if (
    from.toHexString() != ADDRESS_ZERO.toHexString() &&
    from.toHexString() != pair.id
  ) {
    let fromUserLiquidityPosition = createLiquidityPosition(
      event.address,
      from
    );
    fromUserLiquidityPosition.liquidityTokenBalance = convertTokenToDecimal(
      pairContract.balanceOf(from),
      BIG_INT_18
    );
    fromUserLiquidityPosition.save();
    createLiquiditySnapshot(fromUserLiquidityPosition, event);
  }

  if (
    event.params.to.toHexString() != ADDRESS_ZERO.toHexString() &&
    to.toHexString() != pair.id
  ) {
    let toUserLiquidityPosition = createLiquidityPosition(event.address, to);
    toUserLiquidityPosition.liquidityTokenBalance = convertTokenToDecimal(
      pairContract.balanceOf(to),
      BIG_INT_18
    );
    toUserLiquidityPosition.save();
    createLiquiditySnapshot(toUserLiquidityPosition, event);
  }

  transaction.save();
}

export function handleSync(event: Sync): void {
  let pair = SwapPair.load(event.address.toHex()) as SwapPair;
  let token0 = Token.load(pair.token0) as Token;
  let token1 = Token.load(pair.token1) as Token;
  let uniswap = SwapFactory.load(SWAP_FACTORY_ADDRESS.toHexString()) as SwapFactory;

  // reset factory liquidity by subtracting onluy tarcked liquidity
  uniswap.totalLiquidityETH = uniswap.totalLiquidityETH.minus(pair.trackedReserveETH as BigDecimal)

  // reset token total liquidity amounts
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1)

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals)
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals)

  if (pair.reserve1.notEqual(BIG_DECIMAL_ZERO)) pair.token0Price = pair.reserve0.div(pair.reserve1)
  else pair.token0Price = BIG_DECIMAL_ZERO
  if (pair.reserve0.notEqual(BIG_DECIMAL_ZERO)) pair.token1Price = pair.reserve1.div(pair.reserve0)
  else pair.token1Price = BIG_DECIMAL_ZERO

  pair.save()

  // update ETH price now that reserves could have changed
  let bundle = Bundle.load('1') as Bundle;
  bundle.ethPrice = getEthPriceInUSD()
  bundle.save()

  token0.derivedETH = findEthPerToken(token0 as Token)
  token1.derivedETH = findEthPerToken(token1 as Token)
  token0.save()
  token1.save()

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityETH: BigDecimal
  if (bundle.ethPrice.notEqual(BIG_DECIMAL_ZERO)) {
    trackedLiquidityETH = getTrackedLiquidityUSD(pair.reserve0, token0 as Token, pair.reserve1, token1 as Token).div(
      bundle.ethPrice
    )
  } else {
    trackedLiquidityETH = BIG_DECIMAL_ZERO
  }

  // use derived amounts within pair
  pair.trackedReserveETH = trackedLiquidityETH
  pair.reserveETH = pair.reserve0
    .times(token0.derivedETH as BigDecimal)
    .plus(pair.reserve1.times(token1.derivedETH as BigDecimal))
  pair.reserveUSD = pair.reserveETH.times(bundle.ethPrice)

  // use tracked amounts globally
  uniswap.totalLiquidityETH = uniswap.totalLiquidityETH.plus(trackedLiquidityETH)
  uniswap.totalLiquidityUSD = uniswap.totalLiquidityETH.times(bundle.ethPrice)

  // now correctly set liquidity amounts for each token
  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1)

  // save entities
  pair.save()
  uniswap.save()
  token0.save()
  token1.save()
}

export function handleMint(event: Mint): void {
  log.info("handleMint:\n sender: {}\n amount0: {}\n amount1", [
    event.params.sender.toHexString(),
    event.params.amount0.toHexString(),
    event.params.amount1.toHexString(),
  ]);

  let transaction = SwapTransaction.load(event.transaction.hash.toHexString());
  if (!transaction) return;
  let mints = transaction.mints;
  let mint = MintEvent.load(mints[mints.length - 1]) as MintEvent;

  let pair = SwapPair.load(event.address.toHexString()) as SwapPair;
  let dex = SwapFactory.load(SWAP_FACTORY_ADDRESS.toHexString()) as SwapFactory;

  let token0 = Token.load(pair.token0) as Token;
  let token1 = Token.load(pair.token1) as Token;

  // update exchange info (except balances, sync will cover that)
  let token0Amount = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  let token1Amount = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );

  // update txn counts
  token0.txCount = token0.txCount.plus(BIG_INT_ONE);
  token1.txCount = token1.txCount.plus(BIG_INT_ONE);

  // get new amounts of USD and ETH for tracking
  let bundle = Bundle.load("1") as Bundle;

  let amountTotalUSD = (token1.derivedETH as BigDecimal)
    .times(token1Amount)
    .plus((token0.derivedETH as BigDecimal).times(token0Amount))
    .times(bundle.ethPrice);

  // update txn counts
  pair.txCount = pair.txCount.plus(BIG_INT_ONE);
  dex.txCount = dex.txCount.plus(BIG_INT_ONE);

  // save entities
  token0.save();
  token1.save();
  pair.save();
  dex.save();

  mint.sender = event.params.sender;
  mint.amount0 = token0Amount as BigDecimal;
  mint.amount1 = token1Amount as BigDecimal;
  mint.logIndex = event.logIndex;
  mint.amountUSD = amountTotalUSD as BigDecimal;
  mint.save();

  // update the LP position
  let liquidityPosition = createLiquidityPosition(
    event.address,
    Address.fromString(mint.to.toHexString())
  );
  createLiquiditySnapshot(liquidityPosition, event);

  // update day entities
  updatePairDayData(event);
  updatePairHourData(event);
  updateUniswapDayData(event);
  updateTokenDayData(token0 as Token, event);
  updateTokenDayData(token1 as Token, event);
}

export function handleBurn(event: Burn): void {
  log.info("handleBurn:\n sender: {}\n amount0: {}\n amount1: {}\n to: {}", [
    event.params.sender.toHexString(),
    event.params.amount0.toString(),
    event.params.amount1.toString(),
    event.params.to.toHexString(),
  ]);

  let transaction = SwapTransaction.load(event.transaction.hash.toHexString());

  // safety check
  if (transaction === null) return;

  let burns = transaction.burns;
  let burn = BurnEvent.load(burns[burns.length - 1]) as BurnEvent;

  let pair = SwapPair.load(event.address.toHexString()) as SwapPair;
  let dex = SwapFactory.load(SWAP_FACTORY_ADDRESS.toHexString()) as SwapFactory;

  //update token info
  let token0 = Token.load(pair.token0) as Token;
  let token1 = Token.load(pair.token1) as Token;

  let token0Amount = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  let token1Amount = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );

  // update txn counts
  token0.txCount = token0.txCount.plus(BIG_INT_ONE);
  token1.txCount = token1.txCount.plus(BIG_INT_ONE);

  // get new amounts of USD and ETH for tracking
  let bundle = Bundle.load("1") as Bundle;

  let amountTotalUSD = (token1.derivedETH as BigDecimal)
    .times(token1Amount)
    .plus((token0.derivedETH as BigDecimal).times(token0Amount))
    .times(bundle.ethPrice);

  // update txn counts
  dex.txCount = dex.txCount.plus(BIG_INT_ONE);
  pair.txCount = pair.txCount.plus(BIG_INT_ONE);

  // update global counter and save
  token0.save();
  token1.save();
  pair.save();
  dex.save();

  // update burn
  // burn.sender = event.params.sender;
  burn.amount0 = token0Amount as BigDecimal;
  burn.amount1 = token1Amount as BigDecimal;
  // burn.to = event.params.to
  burn.logIndex = event.logIndex;
  burn.amountUSD = amountTotalUSD as BigDecimal;
  burn.save();

  // update the LP position
  const liquidityPosition = createLiquidityPosition(
    event.address,
    event.params.sender
  );
  createLiquiditySnapshot(liquidityPosition, event);

  // update day entities
  updatePairDayData(event);
  updatePairHourData(event);
  updateUniswapDayData(event);
  updateTokenDayData(token0 as Token, event);
  updateTokenDayData(token1 as Token, event);
}

export function handleSwap(event: Swap): void {
  let pair = SwapPair.load(event.address.toHexString()) as SwapPair;

  let token0 = Token.load(pair.token0) as Token;
  let token1 = Token.load(pair.token1) as Token;

  let amount0In = convertTokenToDecimal(
    event.params.amount0In,
    token0.decimals
  );
  let amount1In = convertTokenToDecimal(
    event.params.amount1In,
    token1.decimals
  );
  let amount0Out = convertTokenToDecimal(
    event.params.amount0Out,
    token0.decimals
  );
  let amount1Out = convertTokenToDecimal(
    event.params.amount1Out,
    token1.decimals
  );

  // totals for volume updates
  let amount0Total = amount0Out.plus(amount0In);
  let amount1Total = amount1Out.plus(amount1In);

  // ETH/USD prices
  let bundle = Bundle.load("1") as Bundle;

  // get total amounts of derived USD and ETH for tracking
  let derivedAmountETH = (token1.derivedETH as BigDecimal)
    .times(amount1Total)
    .plus((token0.derivedETH as BigDecimal).times(amount0Total))
    .div(BigDecimal.fromString("2"));
  let derivedAmountUSD = derivedAmountETH.times(bundle.ethPrice);

  // only accounts for volume through white listed tokens
  let trackedAmountUSD = getTrackedVolumeUSD(
    amount0Total,
    token0 as Token,
    amount1Total,
    token1 as Token,
    pair as SwapPair
  );

  let trackedAmountETH: BigDecimal;
  if (bundle.ethPrice.equals(BIG_DECIMAL_ZERO)) {
    trackedAmountETH = BIG_DECIMAL_ZERO;
  } else {
    trackedAmountETH = trackedAmountUSD.div(bundle.ethPrice);
  }

  // update token0 global volume and token liquidity stats
  token0.tradeVolume = token0.tradeVolume.plus(amount0In.plus(amount0Out));
  token0.tradeVolumeUSD = token0.tradeVolumeUSD.plus(trackedAmountUSD);
  token0.untrackedVolumeUSD = token0.untrackedVolumeUSD.plus(derivedAmountUSD);

  // update token1 global volume and token liquidity stats
  token1.tradeVolume = token1.tradeVolume.plus(amount1In.plus(amount1Out));
  token1.tradeVolumeUSD = token1.tradeVolumeUSD.plus(trackedAmountUSD);
  token1.untrackedVolumeUSD = token1.untrackedVolumeUSD.plus(derivedAmountUSD);

  // update txn counts
  token0.txCount = token0.txCount.plus(BIG_INT_ONE);
  token1.txCount = token1.txCount.plus(BIG_INT_ONE);

  // update pair volume data, use tracked amount if we have it as its probably more accurate
  pair.volumeUSD = pair.volumeUSD.plus(trackedAmountUSD);
  pair.volumeToken0 = pair.volumeToken0.plus(amount0Total);
  pair.volumeToken1 = pair.volumeToken1.plus(amount1Total);
  pair.untrackedVolumeUSD = pair.untrackedVolumeUSD.plus(derivedAmountUSD);
  pair.txCount = pair.txCount.plus(BIG_INT_ONE);
  pair.save();

  // update global values, only used tracked amounts for volume
  let dex = SwapFactory.load(SWAP_FACTORY_ADDRESS.toHexString()) as SwapFactory;

  dex.totalVolumeUSD = dex.totalVolumeUSD.plus(trackedAmountUSD);
  dex.totalVolumeETH = dex.totalVolumeETH.plus(trackedAmountETH);
  dex.untrackedVolumeUSD = dex.untrackedVolumeUSD.plus(derivedAmountUSD);
  dex.txCount = dex.txCount.plus(BIG_INT_ONE);

  // save entities
  pair.save();
  token0.save();
  token1.save();
  dex.save();

  let transaction = SwapTransaction.load(event.transaction.hash.toHexString());
  if (transaction === null) {
    transaction = new SwapTransaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.mints = [];
    transaction.swaps = [];
    transaction.burns = [];
  }
  let swaps = transaction.swaps;
  let swap = new SwapEvent(
    event.transaction.hash
      .toHexString()
      .concat("-")
      .concat(BigInt.fromI32(swaps.length).toString())
  );

  // update swap event
  swap.transaction = transaction.id;
  swap.pair = pair.id;
  swap.timestamp = transaction.timestamp;
  swap.transaction = transaction.id;
  swap.sender = event.params.sender;
  swap.amount0In = amount0In;
  swap.amount1In = amount1In;
  swap.amount0Out = amount0Out;
  swap.amount1Out = amount1Out;
  swap.to = event.params.to;
  swap.from = event.transaction.from;
  swap.logIndex = event.logIndex;
  // use the tracked amount if we have it
  swap.amountUSD =
    trackedAmountUSD === BIG_DECIMAL_ZERO ? derivedAmountUSD : trackedAmountUSD;
  swap.save();

  // update the transaction

  // TODO: Consider using .concat() for handling array updates to protect
  // against unintended side effects for other code paths.
  swaps.push(swap.id);
  transaction.swaps = swaps;
  transaction.save();

  // update day entities
  let pairDayData = updatePairDayData(event);
  let pairHourData = updatePairHourData(event);
  let dexDayData = updateUniswapDayData(event);
  let token0DayData = updateTokenDayData(token0 as Token, event);
  let token1DayData = updateTokenDayData(token1 as Token, event);

  // swap specific updating
  dexDayData.dailyVolumeUSD = dexDayData.dailyVolumeUSD.plus(trackedAmountUSD);
  dexDayData.dailyVolumeETH = dexDayData.dailyVolumeETH.plus(trackedAmountETH);
  dexDayData.dailyVolumeUntracked =
    dexDayData.dailyVolumeUntracked.plus(derivedAmountUSD);
  dexDayData.save();

  // swap specific updating for pair
  pairDayData.dailyVolumeToken0 =
    pairDayData.dailyVolumeToken0.plus(amount0Total);
  pairDayData.dailyVolumeToken1 =
    pairDayData.dailyVolumeToken1.plus(amount1Total);
  pairDayData.dailyVolumeUSD =
    pairDayData.dailyVolumeUSD.plus(trackedAmountUSD);
  pairDayData.save();

  // update hourly pair data
  pairHourData.hourlyVolumeToken0 =
    pairHourData.hourlyVolumeToken0.plus(amount0Total);
  pairHourData.hourlyVolumeToken1 =
    pairHourData.hourlyVolumeToken1.plus(amount1Total);
  pairHourData.hourlyVolumeUSD =
    pairHourData.hourlyVolumeUSD.plus(trackedAmountUSD);
  pairHourData.save();

  // swap specific updating for token0
  token0DayData.dailyVolumeToken =
    token0DayData.dailyVolumeToken.plus(amount0Total);
  token0DayData.dailyVolumeETH = token0DayData.dailyVolumeETH.plus(
    amount0Total.times(token0.derivedETH as BigDecimal)
  );
  token0DayData.dailyVolumeUSD = token0DayData.dailyVolumeUSD.plus(
    amount0Total.times(token0.derivedETH as BigDecimal).times(bundle.ethPrice)
  );
  token0DayData.save();

  // swap specific updating
  token1DayData.dailyVolumeToken =
    token1DayData.dailyVolumeToken.plus(amount1Total);
  token1DayData.dailyVolumeETH = token1DayData.dailyVolumeETH.plus(
    amount1Total.times(token1.derivedETH as BigDecimal)
  );
  token1DayData.dailyVolumeUSD = token1DayData.dailyVolumeUSD.plus(
    amount1Total.times(token1.derivedETH as BigDecimal).times(bundle.ethPrice)
  );
  token1DayData.save();
}
