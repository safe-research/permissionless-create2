import "@mantine/core/styles.css";

import { createTheme, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import { App } from "@/components/App.tsx";
import { BurnerProvider } from "@/contexts/Burner.tsx";
import { ConnectorProvider } from "@/contexts/Connector.tsx";

const root = document.getElementById("root");
if (root && !root.innerHTML) {
  const theme = createTheme({});
  const config = createConfig({
    chains: [mainnet],
    transports: {
      [mainnet.id]: http(),
    },
  });
  const client = new QueryClient();

  createRoot(root).render(
    <StrictMode>
      <MantineProvider defaultColorScheme="auto" theme={theme}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={client}>
            <ConnectorProvider>
              <BurnerProvider>
                <App />
              </BurnerProvider>
            </ConnectorProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </MantineProvider>
    </StrictMode>,
  );
}
