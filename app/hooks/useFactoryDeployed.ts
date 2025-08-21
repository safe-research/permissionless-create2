import { useMemo } from "react";
import { useBytecode } from "wagmi";
import { factory } from "@/erc-7955.ts";

function useFactoryDeployed() {
  const bytecode = useBytecode({
    address: factory.address,
  });
  return useMemo(
    () => ({
      ...bytecode,
      data: bytecode.data === factory.runtimeCode,
    }),
    [bytecode],
  );
}

export { useFactoryDeployed };
