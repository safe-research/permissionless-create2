import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { type Address, encodeFunctionData, type Hex } from "viem";
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

  it("should recover from out of gas reverts", async () => {
    const { client, bootstrap, deployerAuthorization } =
      await networkHelpers.loadFixture(fixture);

    const [wallet] = await viem.getWalletClients();
    await wallet.sendTransaction({
      to: `0x${"00".repeat(20)}`,
      authorizationList: [await deployerAuthorization()],
    });

    // Work around viem `.write` methods not submitting transactions that would
    // revert (which we _want_ to do for this test).

    const executor = await viem.deployContract("Executor");
    const call = [
      bootstrap.address,
      encodeFunctionData({
        abi: bootstrap.abi,
        functionName: "deploy",
        args: [],
      }),
    ] as [Address, Hex];
    const gas = await executor.estimateGas.execute(call);

    {
      const {
        result: [success],
        request,
      } = await executor.simulate.execute(call, { gas: gas - 100n });

      assert.strictEqual(success, false);

      await wallet.writeContract(request);
      const code = await client.getCode(factory);

      assert.strictEqual(code, undefined);
    }

    {
      // For some reason, gas estimation is a little off for the deployment,
      // transaction, so bump it so that it succeeds.
      const bump = 1500n;
      const {
        result: [success],
        request,
      } = await executor.simulate.execute(call, { gas: gas + bump });

      assert.strictEqual(success, true);

      await wallet.writeContract(request);
      const code = await client.getCode(factory);

      assert.strictEqual(code, factory.runtimeCode);
    }
  });
});
