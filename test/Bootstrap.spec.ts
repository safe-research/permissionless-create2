import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { type Address, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployer, factory } from "../src/index.ts";

describe("Bootstrap", async () => {
  const { viem, networkHelpers } = await network.connect();

  async function fixture() {
    const client = await viem.getPublicClient();
    const bootstrap = await viem.deployContract("Bootstrap");
    const deployerAccount = privateKeyToAccount(deployer.privateKey);
    const deployerAuthorization = async (contract?: { address: Address }) => {
      const nonce = await client.getTransactionCount({
        address: deployer.address,
      });
      return await deployerAccount.signAuthorization({
        chainId: 0,
        contractAddress: (contract ?? bootstrap).address,
        nonce,
      });
    };
    return { client, bootstrap, deployerAuthorization };
  }

  it("should deploy the CREATE2 factory contract", async () => {
    const { client, bootstrap, deployerAuthorization } =
      await networkHelpers.loadFixture(fixture);

    let code = await client.getCode(factory);

    assert.strictEqual(code, undefined);

    await bootstrap.write.deploy({
      authorizationList: [await deployerAuthorization()],
    });
    code = await client.getCode(factory);

    assert.strictEqual(code, factory.runtimeCode);
  });

  it("should be idempotent", async () => {
    const { client, bootstrap, deployerAuthorization } =
      await networkHelpers.loadFixture(fixture);

    await bootstrap.write.deploy({
      authorizationList: [await deployerAuthorization()],
    });
    const code = await client.getCode(factory);

    assert.strictEqual(code, factory.runtimeCode);

    const delegate = await viem.deployContract("Delegate");
    for (const authorizationList of [
      undefined,
      [await deployerAuthorization(bootstrap)],
      [await deployerAuthorization(delegate)],
    ]) {
      await assert.doesNotReject(bootstrap.write.deploy({ authorizationList }));
    }
  });

  it("should re-delegate the deployer", async () => {
    const { client, bootstrap, deployerAuthorization } =
      await networkHelpers.loadFixture(fixture);

    let code = await client.getCode(factory);

    assert.strictEqual(code, undefined);

    const delegate = await viem.deployContract("Delegate");

    // Manually send a reverting `deploy` transaction, since the Viem contract
    // `write` functions do not submit transactions that would revert. This
    // tests that even reverting transactions apply delegations!
    const [wallet] = await viem.getWalletClients();
    await assert.rejects(
      wallet.sendTransaction({
        to: bootstrap.address,
        data: encodeFunctionData({
          abi: bootstrap.abi,
          functionName: "deploy",
          args: [],
        }),
        gas: 100000n,
        authorizationList: [await deployerAuthorization(delegate)],
      }),
    );

    const delegated = await viem.getContractAt("Delegate", deployer.address);
    const message = await delegated.read.echo(["hello"]);
    code = await client.getCode(factory);

    assert.strictEqual(message, "hello");
    assert.strictEqual(code, undefined);

    await bootstrap.write.deploy({
      authorizationList: [await deployerAuthorization(bootstrap)],
    });
    code = await client.getCode(factory);

    assert.strictEqual(code, factory.runtimeCode);
  });

  it("should revert without a valid delegation", async () => {
    const { bootstrap } = await networkHelpers.loadFixture(fixture);

    await viem.assertions.revertWithCustomError(
      bootstrap.write.deploy(),
      bootstrap,
      "InvalidDelegation",
    );
  });

  it("should revert when bootstrapped without delegation", async () => {
    const { bootstrap } = await networkHelpers.loadFixture(fixture);

    await viem.assertions.revertWithCustomError(
      bootstrap.write.bootstrap(),
      bootstrap,
      "CreationFailed",
    );
  });
});
