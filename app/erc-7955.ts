import { type Hex, parseAbi } from "viem";
import Bootstrap from "../build/hardhat/artifacts/contracts/Bootstrap.sol/Bootstrap.json";

const bootstrap = Object.freeze({
  abi: parseAbi([
    "error InvalidDelegation()",
    "error CreationFailed()",
    "function deploy() external",
  ]),
  bytecode: Bootstrap.bytecode as Hex,
});

export { deployer, factory } from "../src/index.ts";
export { bootstrap };
