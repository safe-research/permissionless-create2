import { useMemo } from "react";
import { defineChain } from "viem";
import {
  createConfig,
  unstable_connector,
  useAccount,
  useConfig,
  WagmiProvider,
} from "wagmi";

// Wagmi typically only allows you to use configured chains. This makes sense
// for most dapps, but not here: we want to use whatever chain the current
// connector we are attached to is using. This allows users, for example, to
// deploy the permissionless CREATE2 factory for whatever network they have
// configured in their MetaMask without this dapp knowing about it in advance.
function ConnectorProvider({ children }: React.PropsWithChildren) {
  const parentConfig = useConfig();
  const { chainId, connector } = useAccount();
  const connectorConfig = useMemo(
    () =>
      chainId && connector
        ? createConfig({
            chains: [
              defineChain({
                id: chainId,
                name: "unknown",
                nativeCurrency: {
                  name: "unknown",
                  symbol: "UNKN",
                  decimals: 18,
                },
                rpcUrls: {
                  default: {
                    http: [],
                  },
                },
              }),
            ],
            transports: {
              [chainId]: unstable_connector(connector),
            },
          })
        : parentConfig,
    [chainId, connector, parentConfig],
  );

  return <WagmiProvider config={connectorConfig}>{children}</WagmiProvider>;
}

export { ConnectorProvider };
