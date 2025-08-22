import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { deployer, factory } from "../src/index.ts";

describe("TypeScript Library", async () => {
  const { viem } = await network.connect();

  it("should match deployer address", () => {
    for (const account of [
      mnemonicToAccount(deployer.mnemonic),
      privateKeyToAccount(deployer.privateKey),
    ]) {
      assert.strictEqual(deployer.address, account.address);
    }
  });

  it("should match Solidity constants", async () => {
    const constants = await viem.deployContract("Constants");

    assert.strictEqual(deployer.address, await constants.read.DEPLOYER());
    assert.strictEqual(factory.salt, await constants.read.SALT());
    assert.strictEqual(factory.address, await constants.read.ADDRESS());
    assert.strictEqual(factory.initCode, await constants.read.INITCODE());
    assert.strictEqual(factory.runtimeCode, await constants.read.RUNCODE());
    assert.strictEqual(factory.codeHash, await constants.read.CODEHASH());
  });
});
