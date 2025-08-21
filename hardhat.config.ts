import viem from "@nomicfoundation/hardhat-toolbox-viem";
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  plugins: [viem],
  paths: {
    artifacts: "build/hardhat/artifacts",
    cache: "build/hardhat/cache",
  },
  solidity: {
    version: "0.8.29",
    settings: {
      evmVersion: "prague",
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
};

export default config;
