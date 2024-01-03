/* eslint-disable prefer-const */
import {
  log,
  BigInt,
  BigDecimal,
  Address,
  ethereum,
  Bytes,
} from "@graphprotocol/graph-ts";

import {
  BIG_INT_ZERO,
  SWAP_FACTORY_ADDRESS,
  BIG_INT_ONE,
  BIG_DECIMAL_ZERO,
  BIG_INT_18,
} from "const";
import { ERC20 } from "../../generated/CreditFactory/ERC20";
import { ERC20SymbolBytes } from "../../generated/CreditFactory/ERC20SymbolBytes";
import { ERC20NameBytes } from "../../generated/CreditFactory/ERC20NameBytes";
import {
  User,
  Bundle,
  Token,
  LiquidityPositionSwap,
  LiquidityPositionSnapshotSwap,
  SwapPair,
} from "../../generated/schema";
import { SwapFactory as FactoryContract } from "../../generated/templates/SwapPair/SwapFactory";

export let factoryContract = FactoryContract.bind(SWAP_FACTORY_ADDRESS);

// rebass tokens, dont count in tracked volume
export let UNTRACKED_PAIRS: string[] = [""];

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString("1");
  for (
    let i = BIG_INT_ZERO;
    i.lt(decimals as BigInt);
    i = i.plus(BIG_INT_ONE)
  ) {
    bd = bd.times(BigDecimal.fromString("10"));
  }
  return bd;
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString("1000000000000000000");
}

export function convertEthToDecimal(eth: BigInt): BigDecimal {
  return eth.toBigDecimal().div(exponentToBigDecimal(new BigInt(18)));
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == BIG_INT_ZERO) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = parseFloat(value.toString());
  const zero = parseFloat(BIG_DECIMAL_ZERO.toString());
  if (zero == formattedVal) {
    return true;
  }
  return false;
}

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  // static definitions overrides
  // let staticDefinition = TokenDefinition.fromAddress(tokenAddress);
  // if (staticDefinition != null) {
  //   return staticDefinition.symbol;
  // }

  let contract = ERC20.bind(tokenAddress);
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress);

  // try types string and bytes32 for symbol
  let symbolValue = "unknown";
  let symbolResult = contract.try_symbol();
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol();
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toString())) {
        symbolValue = symbolResultBytes.value.toString();
      }
    }
  } else {
    symbolValue = symbolResult.value;
  }

  return symbolValue;
}

export function fetchTokenName(tokenAddress: Address): string {
  // static definitions overrides
  // let staticDefinition = TokenDefinition.fromAddress(tokenAddress);
  // if (staticDefinition != null) {
  //   return (staticDefinition as TokenDefinition).name;
  // }

  let contract = ERC20.bind(tokenAddress);
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress);

  // try types string and bytes32 for name
  let nameValue = "unknown";
  let nameResult = contract.try_name();
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name();
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString();
      }
    }
  } else {
    nameValue = nameResult.value;
  }

  return nameValue;
}

export function fetchTokenTotalSupply(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let totalSupplyResult = contract.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    return totalSupplyResult.value;
  }
  return BIG_INT_ZERO;
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  // static definitions overrides
  // let staticDefinition = TokenDefinition.fromAddress(tokenAddress);
  // if (staticDefinition != null) {
  //   return (staticDefinition as TokenDefinition).decimals;
  // }

  let contract = ERC20.bind(tokenAddress);
  // try types uint8 for decimals
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    return BigInt.fromI32(decimalResult.value);
  }
  return BIG_INT_ZERO;
}

export function createLiquidityPosition(
  exchange: Address,
  user: Address
): LiquidityPositionSwap {
  let id = exchange.toHexString().concat("-").concat(user.toHexString());
  let liquidityTokenBalance = LiquidityPositionSwap.load(id);
  if (liquidityTokenBalance === null) {
    let pair = SwapPair.load(exchange.toHexString());
    if (pair) {
      pair.liquidityProviderCount =
        pair.liquidityProviderCount.plus(BIG_INT_ONE);
      pair.save();
    }

    liquidityTokenBalance = new LiquidityPositionSwap(id);
    liquidityTokenBalance.liquidityTokenBalance = BIG_DECIMAL_ZERO;
    liquidityTokenBalance.pair = exchange.toHexString();
    getOrCreateUser(user);
    liquidityTokenBalance.user = user.toHexString();
    liquidityTokenBalance.save();
  }
  if (liquidityTokenBalance === null)
    log.error("LiquidityTokenBalance is null", [id]);
  return liquidityTokenBalance as LiquidityPositionSwap;
}

export function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (user === null) {
    user = new User(address.toHexString());
    user.usdSwapped = BIG_DECIMAL_ZERO;
    user.stakedCreditAllocation = BIG_INT_ZERO;
    user.save();
  }
  return user;
}

export function createLiquiditySnapshot(
  position: LiquidityPositionSwap,
  event: ethereum.Event
): void {
  let timestamp = event.block.timestamp.toI32();
  let bundle = Bundle.load("1");
  let pair = SwapPair.load(position.pair);
  if (!pair || !bundle) return;

  let token0 = Token.load(pair.token0) as Token;
  let token1 = Token.load(pair.token1) as Token;

  // create new snapshot
  let snapshot = new LiquidityPositionSnapshotSwap(
    position.id.concat(timestamp.toString())
  );
  snapshot.liquidityPosition = position.id;
  snapshot.timestamp = timestamp;
  snapshot.block = event.block.number.toI32();
  snapshot.user = position.user;
  snapshot.pair = position.pair;
  snapshot.token0PriceUSD = (token0.derivedETH as BigDecimal).times(
    bundle.ethPrice
  );
  snapshot.token1PriceUSD = (token1.derivedETH as BigDecimal).times(
    bundle.ethPrice
  );
  snapshot.reserve0 = pair.reserve0;
  snapshot.reserve1 = pair.reserve1;
  snapshot.reserveUSD = pair.reserveUSD;
  snapshot.liquidityTokenTotalSupply = pair.totalSupply;
  snapshot.liquidityTokenBalance = position.liquidityTokenBalance;
  snapshot.liquidityPosition = position.id;

  snapshot.save();
  position.save();
}
// sudo graph deploy --product hosted-service revolver0cel0t/volatilis-credit-testnet --access-token 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 --node https://api.thegraph.com/deploy/ 