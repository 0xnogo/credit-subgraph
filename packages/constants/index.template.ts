import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const NULL_CALL_RESULT_VALUE =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export const ADDRESS_ZERO = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

export const BIG_DECIMAL_1E2 = BigDecimal.fromString("1e2");

export const BIG_DECIMAL_1E6 = BigDecimal.fromString("1e6");

export const BIG_DECIMAL_1E16 = BigDecimal.fromString("1e16");

export const BIG_DECIMAL_1E12 = BigDecimal.fromString("1e12");

export const BIG_DECIMAL_1E18 = BigDecimal.fromString("1e18");

export const BIG_DECIMAL_ZERO = BigDecimal.fromString("0");

export const BIG_DECIMAL_ONE = BigDecimal.fromString("1");

export const BIG_INT_ONE = BigInt.fromI32(1);

export const BIG_INT_TWO = BigInt.fromI32(2);

export const BIG_INT_ONE_HUNDRED = BigInt.fromI32(100);

export const BIG_INT_ONE_DAY_SECONDS = BigInt.fromI32(86400);

export const BIG_INT_ZERO = BigInt.fromI32(0);

export const BIG_INT_18 = BigInt.fromI32(18);

export const ACC_CREDIT_PRECISION = BigInt.fromString(
  BIG_DECIMAL_1E12.toString()
);

export const BIG_INT_1E18 = BigInt.fromString(BIG_DECIMAL_1E18.toString());

export const BIG_INT_1E12 = BigInt.fromString(BIG_DECIMAL_1E12.toString());

export const BIG_INT_1E2 = BigInt.fromString(BIG_DECIMAL_1E2.toString());

export const BIG_INT_1E6 = BigInt.fromString(BIG_DECIMAL_1E6.toString());

export const BIG_INT_1E16 = BigInt.fromString(BIG_DECIMAL_1E16.toString());

////////////////////// ADDRESSES ///////////////////////////

// export const WETH_ADDRESS = Address.fromString(
//   "{{ weth_address }}{{^weth_address}}0x0000000000000000000000000000000000000000{{/weth_address}}"
// );

// export const USDC_WETH_PAIR = Address.fromString(
//   "{{ usdc_weth_address }}{{^usdc_weth_address}}0x0000000000000000000000000000000000000000{{/usdc_weth_address}}"
// );

// export const DAI_WETH_PAIR = Address.fromString(
//   "{{ dai_weth_address }}{{^dai_weth_address}}0x0000000000000000000000000000000000000000{{/dai_weth_address}}"
// );

// export const USDT_WETH_PAIR = Address.fromString(
//   "{{ usdt_weth_address }}{{^usdt_weth_address}}0x0000000000000000000000000000000000000000{{/usdt_weth_address}}"
// );

// export const WHITELIST: string[] = "{{ whitelist }}".split(",");

// export const LENDING_FACTORY_ADDRESS = Address.fromString(
//   "{{ lending_factory.address }}{{^lending_factory.address}}0x0000000000000000000000000000000000000000{{/lending_factory.address}}"
// );

// export const SWAP_FACTORY_ADDRESS = Address.fromString(
//   "{{ swap_factory.address }}{{^swap_factory.address}}0x0000000000000000000000000000000000000000{{/swap_factory.address}}"
// );

// export const CONVENIENCE_ADDRESS = Address.fromString(
//   "{{ convenience_adress }}{{^convenience_adress}}0x0000000000000000000000000000000000000000{{/convenience_adress}}"
// );

// export const LP_FARMING_ADDRESS = Address.fromString(
//   "{{ lp_farming.address }}{{^lp_farming.address}}0x0000000000000000000000000000000000000000{{/lp_farming.address}}"
// );

// export const LP_FARMING_START_BLOCK = BigInt.fromString(
//   "{{ lp_farming.startBlock }}"
// );

// export const STAKING_ADDRESS = Address.fromString(
//   "{{ credit_staking.address }}{{^credit_staking.address}}0x0000000000000000000000000000000000000000{{/credit_staking.address}}"
// );

// export const CREDIT_TOKEN_ADDRESS = Address.fromString(
//   "{{ credit_token_address }}{{^credit_token_address}}0x0000000000000000000000000000000000000000{{/credit_token_address}}"
// );

// export const CREDIT_POSITION_ADDRESS = Address.fromString(
//   "{{ credit_position.address }}{{^credit_position.address}}0x0000000000000000000000000000000000000000{{/credit_position.address}}"
// );
