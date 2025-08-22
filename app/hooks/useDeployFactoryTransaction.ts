import { useCallback, useEffect, useState } from "react";
import {
  type Address,
  encodeFunctionData,
  type TransactionRequestEIP7702,
} from "viem";
import { signAuthorization } from "viem/accounts";
import { useTransactionCount } from "wagmi";
import { bootstrap, deployer } from "@/erc-7955.ts";

function useDeployFactoryTransaction({
  bootstrap: { address: bootstrapAddress },
}: {
  bootstrap: { address: Address | null };
}) {
  const { data: nonce } = useTransactionCount({
    address: deployer.address,
  });
  const [transaction, setTransaction] =
    useState<TransactionRequestEIP7702 | null>(null);

  const buildTransaction = useCallback(async () => {
    if (!bootstrapAddress || nonce === undefined) {
      setTransaction(null);
      return;
    }

    const authorization = await signAuthorization({
      privateKey: deployer.privateKey,
      chainId: 0,
      address: bootstrapAddress,
      nonce,
    });

    setTransaction({
      to: bootstrapAddress,
      data: encodeFunctionData({
        abi: bootstrap.abi,
        functionName: "deploy",
      }),
      authorizationList: [authorization],
    });
  }, [bootstrapAddress, nonce]);

  useEffect(() => {
    buildTransaction();
  }, [buildTransaction]);

  return transaction;
}

export { useDeployFactoryTransaction };
