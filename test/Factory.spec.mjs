import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import {
  DEPLOYER,
  deployFactory,
  signDeployerDelegation,
} from "../src/index.mjs";

describe("Factory", function () {
  const { ethers, network } = hre;

  describe("bootstrap", function () {
    let signer;
    before(function () {
      // Currently, Hardhat does not work with EIP-7702 transactions, so we need
      // to manually create communicate with the node. Skip these tests if
      // running against on the Hardhat network.
      // <https://github.com/NomicFoundation/hardhat/issues/6578>
      if (network.name !== "localhost") {
        this.skip();
      }
    });

    it("should deploy the CREATE2 factory contract", async function () {
      const [signer] = await ethers.getSigners();
      const factory = await deployFactory(signer);
      const code = await ethers.provider.getCode(factory);

      expect(ethers.dataLength(code)).to.be.gt(0);
    });

    // This test is only useful if we are in a known initial empty state. This
    // is impractical with `localhost` node, so keep this test around until
    // Hardhat with `hardhat-ethers` supports EIP-7702 transactions. This test
    // can be manually run by `s/skip/only/` and running against a blank local
    // development node.
    it.skip("should re-delegate the deployer", async function () {
      const [signer] = await ethers.getSigners();
      const constants = await ethers.deployContract("Constants");
      await constants.deploymentTransaction().wait();

      let factory = await constants.ADDRESS();
      let code = await ethers.provider.getCode(factory);

      expect(code).to.equal("0x");

      const delegate = await ethers.deployContract("Delegate");
      await delegate.deploymentTransaction().wait();

      await expect(
        deployFactory(signer, { bootstrap: await delegate.getAddress() }),
      ).to.be.rejected;

      const message = await delegate.attach(DEPLOYER).echo("hello");
      code = await ethers.provider.getCode(factory);

      expect(message).to.equal("hello");
      expect(code).to.equal("0x");

      factory = await deployFactory(signer);
      code = await ethers.provider.getCode(factory);

      expect(factory).to.equal(await constants.ADDRESS());
      expect(code).to.equal(await constants.RUNCODE());
    });

    it("should deploy to the epected address", async function () {
      const [signer] = await ethers.getSigners();
      const factory = await deployFactory(signer);
      const code = await ethers.provider.getCode(factory);

      const constants = await ethers.deployContract("Constants");
      expect(factory).to.equal(await constants.ADDRESS());
      expect(code).to.equal(await constants.RUNCODE());
      expect(ethers.keccak256(code)).to.equal(await constants.CODEHASH());
    });

    it("should be idempotent", async function () {
      const [signer] = await ethers.getSigners();
      const factory1 = await deployFactory(signer);
      const factory2 = await deployFactory(signer);

      expect(factory1).to.equal(factory2);

      const bootstrap = await ethers.deployContract("Bootstrap");
      await expect(bootstrap.deploy()).to.not.be.reverted;
    });

    it("should allow CREATE2 deployments of contracts", async function () {
      const [signer] = await ethers.getSigners();
      const factory = await deployFactory(signer);

      const Bootstrap = await ethers.getContractFactory("Bootstrap");
      const { data: code } = await Bootstrap.getDeployTransaction();
      const salt = ethers.randomBytes(32);

      const data = ethers.concat([salt, code]);
      const [address] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"],
        await signer.call({ to: factory, data }),
      );

      expect(address).to.equal(
        ethers.getCreate2Address(factory, salt, ethers.keccak256(code)),
      );
      expect(await ethers.provider.getCode(address)).to.equal("0x");

      const create = await signer.sendTransaction({ to: factory, data });
      await create.wait();
      const deployed = await ethers.provider.getCode(address);

      expect(ethers.dataLength(deployed)).to.be.gt(0);
    });
  });

  describe("constants", function () {
    it("should have correct constants", async function () {
      const constants = await ethers.deployContract("Constants");

      const address = ethers.getCreate2Address(
        await constants.DEPLOYER(),
        await constants.SALT(),
        ethers.keccak256(await constants.INITCODE()),
      );

      expect(await constants.ADDRESS()).to.equal(address);

      const [signer] = await ethers.getSigners();
      const tx = await signer.sendTransaction({
        data: await constants.INITCODE(),
      });
      const { contractAddress: factory } = await tx.wait();
      const code = await ethers.provider.getCode(factory);
      const codeHash = ethers.keccak256(code);

      expect(await constants.RUNCODE()).to.equal(code);
      expect(await constants.CODEHASH()).to.equal(codeHash);
    });

    // This test takes a long time to run, so skip it by default.
    it.skip("should be a verifiably computed salt", async function () {
      this.timeout(300000);

      const constants = await ethers.deployContract("Constants");

      const deployer = await constants.DEPLOYER();
      const initCodeHash = ethers.keccak256(await constants.INITCODE());
      const expectedSalt = BigInt(await constants.SALT());
      for (let salt = 0n; salt < ethers.MaxUint256; salt++) {
        const address = ethers.getCreate2Address(
          deployer,
          ethers.toBeHex(salt, 32),
          initCodeHash,
        );
        if (address.startsWith("0xC0DE")) {
          expect(salt).to.eq(expectedSalt);
          break;
        }
      }
    });
  });

  describe("implementation", function () {
    async function fixture() {
      const constants = await ethers.deployContract("Constants");
      const [signer] = await ethers.getSigners();
      const tx = await signer.sendTransaction({
        data: await constants.INITCODE(),
      });
      const { contractAddress: factory } = await tx.wait();
      const deploy = async ({ salt, code }) => {
        const data = ethers.concat([salt, code]);
        const [address] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["address"],
          await signer.call({ to: factory, data }),
        );
        const create = await signer.sendTransaction({ to: factory, data });
        const receipt = await create.wait();
        if (receipt.status !== 1) {
          throw new Error("transaction reverted");
        }
        return address;
      };

      return { signer, factory, deploy };
    }

    async function getInitCode(contract) {
      const factory = await ethers.getContractFactory(contract);
      const { data: code } = await factory.getDeployTransaction();
      return code;
    }

    it("should allow CREATE2 deployments of contracts", async function () {
      const { factory, deploy } = await loadFixture(fixture);

      const code = await getInitCode("Bootstrap");
      const salt = ethers.randomBytes(32);
      const address = ethers.getCreate2Address(
        factory,
        salt,
        ethers.keccak256(code),
      );

      expect(await ethers.provider.getCode(address)).to.equal("0x");

      const deployedAddress = await deploy({ salt, code });
      const deployedCode = await ethers.provider.getCode(address);

      expect(deployedAddress).to.equal(address);
      expect(ethers.dataLength(deployedCode)).to.be.gt(0);
    });

    it("should allow CREATE2 deployments with empty code", async function () {
      const { factory, deploy } = await loadFixture(fixture);

      const salt = ethers.randomBytes(32);
      const address = ethers.getCreate2Address(factory, salt, ethers.id(""));

      const deployedAddress = await deploy({ salt, code: "0x" });
      const deployedCode = await ethers.provider.getCode(address);

      expect(deployedAddress).to.equal(address);
      expect(deployedCode).to.equal("0x");
    });

    it("should revert when input is incorrectly encoded", async function () {
      const { signer, factory } = await loadFixture(fixture);

      const salt = ethers.randomBytes(32);
      for (let i = 0; i < 32; i++) {
        const data = ethers.dataSlice(salt, 0, i);
        await expect(signer.call({ to: factory, data })).to.be.rejected;
      }
    });

    it("should propagate reverts", async function () {
      const { deploy } = await loadFixture(fixture);

      const code = await getInitCode("Revert");
      const salt = ethers.randomBytes(32);

      await expect(deploy({ salt, code })).to.be.revertedWith(
        "all your base are belong to us",
      );
    });
  });
});
