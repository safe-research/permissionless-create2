import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { artifacts, network } from "hardhat";
import {
  bytesToHex,
  decodeAbiParameters,
  encodeErrorResult,
  encodePacked,
  getContractAddress,
  type Hex,
  keccak256,
  parseAbi,
  size,
  slice,
} from "viem";

describe("Permissionless CREATE2 Factory", async () => {
  const { viem, networkHelpers } = await network.connect();

  describe("constants", () => {
    it("should have correct derived constants", async () => {
      const constants = await viem.deployContract("Constants");

      const address = getContractAddress({
        opcode: "CREATE2",
        from: await constants.read.DEPLOYER(),
        salt: await constants.read.SALT(),
        bytecode: await constants.read.INITCODE(),
      });

      assert.equal(await constants.read.ADDRESS(), address);

      const client = await viem.getPublicClient();
      const [wallet] = await viem.getWalletClients();
      const hash = await wallet.sendTransaction({
        data: await constants.read.INITCODE(),
      });
      const { contractAddress: factory } =
        await client.waitForTransactionReceipt({ hash });
      if (!factory) {
        throw new Error("factory test deployment failed");
      }
      const runtimeCode = (await client.getCode({ address: factory })) ?? "0x";
      const codeHash = keccak256(runtimeCode);

      assert.equal(await constants.read.RUNCODE(), runtimeCode);
      assert.equal(await constants.read.CODEHASH(), codeHash);
    });

    it("should be a verifiably computed salt", async () => {
      const constants = await viem.deployContract("Constants");

      const contract = {
        opcode: "CREATE2",
        from: await constants.read.DEPLOYER(),
        salt: new Uint8Array(32),
        bytecodeHash: keccak256(await constants.read.INITCODE()),
      } as const;
      const saltData = new DataView(contract.salt.buffer, 24, 8);

      const max = 1n << 64n;
      for (let salt = 0n; salt < max; salt++) {
        saltData.setBigUint64(0, salt);
        const address = getContractAddress(contract);
        if (address.startsWith("0xC0DE")) {
          assert.equal(BigInt(await constants.read.SALT()), salt);
          return;
        }
      }

      throw new Error("no valid salt found");
    });
  });

  describe("implementation", () => {
    async function fixture() {
      const client = await viem.getPublicClient();
      const [wallet] = await viem.getWalletClients();

      const constants = await viem.deployContract("Constants");
      const factory = await constants.read.ADDRESS();

      await networkHelpers.setCode(factory, await constants.read.RUNCODE());

      const deploy = async (deployment: { salt: Hex; bytecode: Hex }) => {
        const call = {
          to: factory,
          data: encodeDeployment(deployment),
        };
        const { data } = await client.call(call);
        const [address] = decodeAbiParameters(
          [{ type: "address" }],
          data || "0x",
        );
        const create = await wallet.sendTransaction(call);
        const receipt = await client.waitForTransactionReceipt({
          hash: create,
        });
        if (receipt.status !== "success") {
          throw new Error("transaction reverted");
        }
        return address;
      };

      return { client, factory, deploy };
    }

    function randomSalt() {
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);
      return bytesToHex(salt);
    }

    function encodeDeployment({
      salt,
      bytecode,
    }: {
      salt: Hex;
      bytecode: Hex;
    }) {
      return encodePacked(["bytes32", "bytes"], [salt, bytecode]);
    }

    it("should allow CREATE2 deployments of contracts", async () => {
      const { client, factory, deploy } =
        await networkHelpers.loadFixture(fixture);

      const salt = randomSalt();
      const { bytecode } = await artifacts.readArtifact("Bootstrap");
      const address = getContractAddress({
        opcode: "CREATE2",
        from: factory,
        salt,
        bytecode,
      });

      assert.equal(await client.getCode({ address }), undefined);

      const deployedAddress = await deploy({ salt, bytecode });
      const deployedCode = (await client.getCode({ address })) ?? "0x";

      assert.strictEqual(deployedAddress, address);
      assert.notEqual(size(deployedCode), 0);
    });

    it("should allow CREATE2 deployments with empty code", async () => {
      const { client, factory, deploy } =
        await networkHelpers.loadFixture(fixture);

      const salt = randomSalt();
      const bytecode = "0x";
      const address = getContractAddress({
        opcode: "CREATE2",
        from: factory,
        salt,
        bytecode,
      });

      const deployedAddress = await deploy({ salt, bytecode });
      const deployedCode = (await client.getCode({ address })) ?? "0x";

      assert.strictEqual(deployedAddress, address);
      assert.strictEqual(deployedCode, "0x");
    });

    it("should revert when input is incorrectly encoded", async () => {
      const { client, factory } = await networkHelpers.loadFixture(fixture);

      const salt = randomSalt();
      for (let i = 0; i < 32; i++) {
        const data = slice(salt, 0, i);
        await assert.rejects(client.call({ to: factory, data }));
      }
    });

    it("should propagate reverts", async () => {
      const { factory } = await networkHelpers.loadFixture(fixture);

      const salt = randomSalt();
      const { bytecode } = await artifacts.readArtifact("Revert");

      // Work around viem assertions only working for contract calls: we do an
      // onchain call to an "executor" contract that just returns whether or not
      // the underlying call succeeded and the complete return data.

      const executor = await viem.deployContract("Executor");
      const {
        result: [success, result],
      } = await executor.simulate.execute([
        factory,
        encodeDeployment({ salt, bytecode }),
      ]);
      const error = encodeErrorResult({
        abi: parseAbi(["error Error(string)"]),
        args: ["all your base are belong to us"],
      });

      assert.strictEqual(success, false);
      assert.strictEqual(result, error);
    });
  });
});
