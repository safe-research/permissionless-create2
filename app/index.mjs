import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/curves/utils.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

import BootstrapArtifact from "../build/hardhat/artifacts/contracts/Bootstrap.sol/Bootstrap.json" with {
  type: "json",
};

const providers = [];

function providerAnnounced({ detail: { info, provider } }) {
  const select = document.querySelector("#wallet-provider");

  const index = providers.length;
  providers.push(provider);

  const name = document.createTextNode(info.name);
  const option = document.createElement("option");
  option.appendChild(name);
  option.setAttribute("value", index);
  select.appendChild(option);

  const connect = document.querySelector("#wallet-connect");
  connect.disabled = false;
}

let jsonrpcId = 0;
async function jsonrpc(request) {
  const select = document.querySelector("#wallet-provider");
  const provider = providers[select.value];
  if (provider === undefined) {
    throw new Error("no provider selected");
  }
  const id = jsonrpcId++;
  try {
    console.debug(`jsonrpc::req[${id}]`, request);
    const response = await provider.request(request);
    console.debug(`jsonrpc::res[${id}]`, response);
    return response;
  } catch (err) {
    console.debug(`jsonrpc::err[${id}]`, err);
    throw new Error(err.message ?? "unknown RPC error");
  }
}

async function connectProvider() {
  const select = document.querySelector("#wallet-provider");
  const connect = document.querySelector("#wallet-connect");

  select.disabled = true;
  connect.disabled = true;
  try {
    await updateStatuses();
  } catch (err) {
    select.disabled = false;
    connect.disabled = false;
    throw err;
  }
}

async function updateStatuses() {
  const wallet = document.querySelector("#wallet-details");
  const b = {
    status: document.querySelector("#bootstrap-status"),
    deploy: document.querySelector("#bootstrap-deploy"),
  };
  const f = {
    status: document.querySelector("#factory-status"),
    deploy: document.querySelector("#factory-deploy"),
  };

  const [account] = await jsonrpc({ method: "eth_requestAccounts" });
  const [chainId, bootstrap, factory] = await Promise.all([
    jsonrpc({ method: "eth_chainId" }),
    deployedBootstrap(),
    deployedFactory(),
  ]);

  wallet.innerText = `${checksumAddress(account)}@${BigInt(chainId)}`;

  if (bootstrap !== null) {
    b.status.innerText = "Deployed";
  } else {
    b.status.innerText = "Not Deployed";
    b.deploy.disabled = factory !== null;
  }

  if (factory !== null) {
    f.status.innerText = "Deployed";
  } else {
    f.status.innerText = "Not Deployed";
    f.deploy.disabled = bootstrap === null;
  }
}

function isAddress(value) {
  return `${value}`.match(/^0x[0-9A-Fa-f]{40}$/);
}

async function deployedBootstrap(newValue) {
  const chainId = await jsonrpc({ method: "eth_chainId" });
  const key = `bootstrap:${chainId}`;

  const value = window.localStorage.getItem(key);
  if (isAddress(newValue)) {
    window.localStorage.setItem(key, newValue);
  }

  if (isAddress(value)) {
    return value;
  } else {
    return null;
  }
}

async function deployedFactory() {
  const address = "0xC0DEb853af168215879d284cc8B4d0A645fA9b0E";
  const code = await jsonrpc({
    method: "eth_getCode",
    params: [address, "latest"],
  });
  if (code === "0x60203d3d3582360380843d373d34f5806019573d813d933efd5b3d52f3") {
    return address;
  } else {
    return null;
  }
}

function burnerAccount() {
  const storedKey = window.localStorage.getItem("burner") ?? "";
  const accountExists = storedKey.match(/^[0-9a-f]{64}$/);
  const privateKey = accountExists ? hexToBytes(storedKey) : randomBytes(32);
  if (!accountExists) {
    window.localStorage.setItem("burner", bytesToHex(privateKey));
  }

  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const addressBytes = keccak_256(publicKey.subarray(1)).subarray(12);
  const address = checksumAddress(bytesToHex(addressBytes));
  return { address, privateKey };
}

async function deployBootstrap() {
  const status = document.querySelector("#bootstrap-status");
  const deploy = document.querySelector("#bootstrap-deploy");

  status.innerText = "Deploying...";
  deploy.disabled = true;
  try {
    const { bytecode } = BootstrapArtifact;
    const { status, contractAddress } = await sendTransaction({
      data: bytecode,
    });
    if (status === "0x1") {
      await deployedBootstrap(contractAddress);
    }
  } finally {
    await updateStatuses();
  }
}

async function deployFactory() {
  const burner = document.querySelector("#burner-address");
  const notify = document.querySelector("#factory-notify");
  const status = document.querySelector("#factory-status");
  const deploy = document.querySelector("#factory-deploy");

  status.innerText = "Deploying...";
  deploy.disabled = true;
  try {
    const bootstrap = await deployedBootstrap();
    const chainId = await jsonrpc({ method: "eth_chainId" });
    const nonce = await jsonrpc({
      method: "eth_getTransactionCount",
      params: ["0x962560A0333190D57009A0aAAB7Bfa088f58461C", "latest"],
    });
    const authorization = signDelegation({
      chainId,
      address: bootstrap,
      nonce,
    });
    const deployment = {
      to: bootstrap,
      data: "0x775c300c",
      authorizationList: [authorization],
    };

    let receipt;
    if (!notify.checkVisibility()) {
      try {
        receipt = await sendTransaction(deployment);

        // Unfortunately, some wallets like Brave will not only correctly
        // estimate gas and not detect reverts for type 0x4 transactions, but
        // happily execute the transaction with the `authorizationList` removed.
        // Unfortunately, the only way to detect this is when the transaction
        // reverted (although, it may be a false positive - something else like
        // a front-run grief attack may have caused the revert).
        if (receipt.status !== "0x1") {
          throw new Error("0xa9e649e9"); // InvalidDeligation() error
        }
      } catch (err) {
        const message = err.message ?? "";
        if (
          message.indexOf("EIP-7702") >= 0 || message.indexOf("0xa9e649e9") >= 0
        ) {
          burner.innerText = burnerAccount().address;
          notify.style = {};
          deploy.innerText = "Deploy with Burner";
          return;
        } else {
          throw err;
        }
      }
    } else {
      receipt = await sendBurnerTransaction(deployment);
    }

    const { status } = receipt;
    if (status === "0x1") {
      await sleep(1000);
    }
  } finally {
    await updateStatuses();
  }
}

async function sendTransaction(transaction) {
  const [account] = await jsonrpc({ method: "eth_requestAccounts" });
  const gas = transaction.gas ?? await jsonrpc({
    method: "eth_estimateGas",
    params: [{
      ...transaction,
      from: account,
    }],
  });
  const transactionHash = await jsonrpc({
    method: "eth_sendTransaction",
    params: [{
      ...transaction,
      from: account,
      gas,
    }],
  });
  return await waitForTransaction(transactionHash);
}

async function sendBurnerTransaction(transaction) {
  const { address, privateKey } = burnerAccount();
  const baseFeePerGas = transaction.maxFeePerGas ??
    transaction.maxPriorityFeePerGas ?? await jsonrpc({
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    }).then((block) => BigInt(block.baseFeePerGas));
  const maxFeePerGas = transaction.maxFeePerGas ?? 2n * baseFeePerGas;
  // `eth_maxPriorityFeePerGas` is not generally supported, in particular
  // MetaMask does not support it.
  let maxPriorityFeePerGas;
  try {
    maxPriorityFeePerGas = transaction.maxPriorityFeePerGas ??
      BigInt(
        await jsonrpc({
          method: "eth_maxPriorityFeePerGas",
        }),
      );
  } catch {
    const gasPrice = BigInt(await jsonrpc({ method: "eth_gasPrice" }));
    const priorityFee = gasPrice - baseFeePerGas;
    const minPriorityFee = 1n + (baseFeePerGas / 100n);
    maxPriorityFeePerGas = clamp(minPriorityFee, priorityFee, maxFeePerGas);
  }
  const gas = transaction.gas ?? (10000n + BigInt(
    await jsonrpc({
      method: "eth_estimateGas",
      params: [{
        ...transaction,
        from: address,
      }],
    }),
  ));
  const balance = BigInt(
    await jsonrpc({
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  );

  const missingGasFunds = (gas * maxFeePerGas) - balance;
  if (missingGasFunds > 0n) {
    const bufferedGasFunds = (missingGasFunds * 15n) / 10n;
    await sendTransaction({ to: address, value: `0x${bufferedGasFunds}` });
  }

  const fields = [
    BigInt(await jsonrpc({ method: "eth_chainId" })),
    BigInt(
      await jsonrpc({
        method: "eth_getTransactionCount",
        params: [address, "latest"],
      }),
    ),
    maxPriorityFeePerGas,
    maxFeePerGas,
    gas,
    transaction.to,
    BigInt(transaction.value ?? 0),
    transaction.data ?? "0x",
    transaction.accessList?.map(() => {
      throw new Error("burner account does not support access lists");
    }) || [],
    transaction.authorizationList?.map((authorization) => [
      BigInt(authorization.chainId),
      authorization.address,
      BigInt(authorization.nonce),
      BigInt(authorization.yParity),
      BigInt(authorization.r),
      BigInt(authorization.s),
    ]) || [],
  ];
  const encodedTransaction = hexConcat("0x04", rlp(fields));
  const { r, s, yParity } = ecdsaSign({
    message: encodedTransaction,
    privateKey,
  });
  const rawTransaction = hexConcat(
    "0x04",
    rlp([...fields, BigInt(yParity), BigInt(r), BigInt(s)]),
  );
  const transactionHash = await jsonrpc({
    method: "eth_sendRawTransaction",
    params: [rawTransaction],
  });
  return await waitForTransaction(transactionHash);
}

async function waitForTransaction(transactionHash) {
  let receipt = null;
  do {
    await sleep(1000);
    receipt = await jsonrpc({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });
  } while (receipt === null);

  return receipt;
}

function signDelegation({ chainId, address, nonce }) {
  const message = hexConcat(
    "0x05",
    rlp([BigInt(chainId), address, BigInt(nonce)]),
  );
  const privateKey = hexToBytes(
    "942ba639ec667bdded6d727ad2e483648a34b584f916e6b826fdb7b512633731",
  );
  const signature = ecdsaSign({ message, privateKey });

  return {
    chainId,
    address,
    nonce,
    ...signature,
  };
}

function clamp(min, value, max) {
  return value < min ? min : value > max ? max : value;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rlp(value) {
  function intBytes(value) {
    const hex = value.toString(16).replace(/^0*/, "");
    const padding = "0".repeat(hex.length % 2);
    return `0x${padding}${hex}`;
  }
  function lenPrefix(hex, offset) {
    const len = hexLength(hex);
    if (len < 56) {
      const prefix = (len + offset).toString(16);
      return hexConcat(prefix, hex);
    } else {
      // Be even more restrictive with maximum length... We only need
      // to encode short RLP data.
      if (len > 0xffffffff) {
        throw new Error("too long");
      }
      const lhex = intBytes(len);
      const llen = hexLength(lhex);
      const prefix = (llen + offset + 55).toString(16);
      return hexConcat(prefix, lhex, hex);
    }
  }

  if (Array.isArray(value)) {
    const items = hexConcat(...value.map(rlp));
    return lenPrefix(items, 0xc0);
  } else if (typeof value === "string") {
    if (hexLength(value) && Number(value) < 0x80) {
      return value;
    } else {
      return lenPrefix(value, 0x80);
    }
  } else if (typeof value === "bigint") {
    return rlp(intBytes(value));
  } else {
    throw new Error(`invalid value ${value}`);
  }
}

function hexLength(hex) {
  return hex.replace(/^0x/, "").length / 2;
}

function hexConcat(...hex) {
  const stripped = hex.map((h) => h.replace(/^0x/, ""));
  return `0x${stripped.join("")}`;
}

function checksumAddress(addressHex) {
  addressHex = addressHex.replace(/^0x/, "");
  const checksum = keccak_256(new TextEncoder().encode(addressHex));
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    const byte = checksum[i >> 1];
    const nibble = i % 2 === 0 ? byte >> 4 : byte & 0xf;
    const digit = addressHex.substr(i, 1);
    const ck = nibble >= 8 ? digit.toUpperCase() : digit;
    address = `${address}${ck}`;
  }
  return address;
}

function ecdsaSign({ message, privateKey }) {
  const digest = keccak_256(hexToBytes(message.replace(/^0x/, "")));
  const { r, s, recovery } = secp256k1.sign(digest, privateKey, {
    format: "recovered",
  });

  return {
    yParity: `0x${recovery}`,
    r: `0x${r.toString(16).padStart(64, "0")}`,
    s: `0x${s.toString(16).padStart(64, "0")}`,
  };
}

function handler(f) {
  return async (...args) => {
    try {
      await f(...args);
    } catch (err) {
      console.error(err);
      alert(err.message ?? "unknown error");
    }
  };
}

window.addEventListener("eip6963:announceProvider", handler(providerAnnounced));
window.dispatchEvent(new Event("eip6963:requestProvider"));

document
  .querySelector("#wallet-connect")
  .addEventListener("click", handler(connectProvider));
document
  .querySelector("#bootstrap-deploy")
  .addEventListener("click", handler(deployBootstrap));
document
  .querySelector("#factory-deploy")
  .addEventListener("click", handler(deployFactory));
