import {
  Anchor,
  AppShell,
  Blockquote,
  Code,
  Container,
  Group,
  Space,
  Text,
} from "@mantine/core";
import { Connect } from "@/components/Connect.tsx";
import { Deploy } from "@/components/Deploy.tsx";

function App() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text>ERC-7955: Permissionless CREATE2 Factory</Text>
          <Connect />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container>
          <Blockquote>
            <Text>
              The ERC-7955 permissionless CREATE2 factory can be deployed by
              anyone. Connect your wallet in order to deploy the CREATE2 factory
              contract to{" "}
              <Code>0xC0DEb853af168215879d284cc8B4d0A645fA9b0E</Code>.
            </Text>
            <Space h="md" />
            <Text>
              You can read more about it{" "}
              <Anchor
                target="_blank"
                rel="noopener noreferrer"
                href="https://ercs.ethereum.org/ERCS/erc-7955"
              >
                here
              </Anchor>
              .
            </Text>
          </Blockquote>
          <Space h="xl" />
          <Deploy />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export { App };
