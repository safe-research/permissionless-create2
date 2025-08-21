import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { type Address, type Hex, isAddress, size } from "viem";
import { getCode } from "viem/actions";
import { useClient } from "wagmi";

function key(chainId: number) {
  return `bootstrap:${chainId}`;
}

function getBootstrap(chainId: number) {
  const stored = localStorage.getItem(key(chainId));
  return stored && isAddress(stored) ? stored : undefined;
}

function setBootstrap(chainId: number, address: Address | null) {
  if (address) {
    localStorage.setItem(key(chainId), address);
  } else {
    localStorage.removeItem(key(chainId));
  }
}

function useBootstrapContract() {
  const client = useClient();
  const [address, setAddress] = useState<Address | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isFetching, startFetching] = useTransition();

  const fetch = useCallback(async () => {
    if (!client) {
      setAddress(null);
      return;
    }
    const bootstrap = getBootstrap(client.chain.id);
    if (bootstrap === undefined) {
      setAddress(null);
      return;
    }

    let bytecode: Hex | undefined;
    try {
      bytecode = await getCode(client, {
        address: bootstrap,
      });
    } catch {
      setAddress(null);
      return;
    }

    if (size(bytecode ?? "0x") > 0) {
      setAddress(bootstrap);
    } else {
      setAddress(null);
    }
  }, [client]);

  const refetch = useCallback(() => startFetching(fetch), [fetch]);

  const deployed = useCallback(
    ({ address }: { address: Address }) => {
      if (client) {
        setBootstrap(client.chain.id, address);
        setAddress(address);
      }
    },
    [client],
  );

  useEffect(() => startLoading(fetch), [fetch]);
  return useMemo(
    () => ({
      address,
      isLoading,
      isFetching,
      refetch,
      deployed,
    }),
    [address, isLoading, isFetching, refetch, deployed],
  );
}

export { useBootstrapContract };
