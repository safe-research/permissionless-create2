import { ethers } from "ethers";
import BOOTSTRAP from "../build/hardhat/artifacts/contracts/Bootstrap.sol/Bootstrap.json" with { type: "json" };

export const MNEMONIC =
  "make code code code code code code code code code code coconut";

export const DEPLOYER = "0x962560A0333190D57009A0aAAB7Bfa088f58461C";
export const FACTORY = "0xC0DE945918F144DcdF063469823a4C51152Df05D";
export const RUNCODE = "0x60203d3d3582360380843d373d34f580601457fd5b3d52f3";

export async function deployFactory(
  signer,
  { bootstrap: bootstrapAddress } = {},
) {
  let code = await signer.provider.getCode(FACTORY);
  if (code == RUNCODE) {
    return FACTORY;
  }

  const bootstrapContractFactory = new ethers.ContractFactory(
    BOOTSTRAP.abi,
    BOOTSTRAP.bytecode,
    signer,
  );
  let bootstrap;
  if (bootstrapAddress) {
    bootstrap = bootstrapContractFactory.attach(bootstrapAddress);
  } else {
    bootstrap = await bootstrapContractFactory.deploy();
    await bootstrap.deploymentTransaction().wait();
  }

  const { chainId } = await signer.provider.getNetwork();
  const nonce = await signer.provider.getTransactionCount(DEPLOYER);
  const authorization = signDeployerDelegation({
    chainId,
    address: await bootstrap.getAddress(),
    nonce,
  });

  const tx = await bootstrap.deploy({ authorizationList: [authorization] });
  const receipt = await tx.wait();

  code = await signer.provider.getCode(FACTORY);
  if (code != RUNCODE) {
    throw new FactoryDeploymentError({
      bootstrap: await bootstrap.getAddress(),
      transactionHash: receipt.hash,
    });
  }

  return FACTORY;
}

export function signDeployerDelegation({ chainId, address, nonce }) {
  const deployer = ethers.Wallet.fromPhrase(MNEMONIC);
  const message = ethers.concat([
    "0x05", // MAGIC
    ethers.encodeRlp([
      ethers.toBeArray(chainId),
      ethers.getAddress(address),
      ethers.toBeArray(nonce),
    ]),
  ]);
  const signature = deployer.signingKey.sign(ethers.keccak256(message));
  return {
    chainId,
    address,
    nonce,
    signature: signature.serialized,
  };
}

export class FactoryDeploymentError extends Error {
  constructor({ bootstrap, transactionHash }, options) {
    super("CREATE2 factory deployment failed", options);
    this.bootstrap = bootstrap;
    this.transactionHash = transactionHash;
  }
}
