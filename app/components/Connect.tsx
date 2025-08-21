import { Box, Button, Code, Group, Select } from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function Connect() {
  const { isConnected } = useAccount();

  return isConnected ? <Account /> : <DoConnect />;
}

function Account() {
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();

  const shortAddress = `${address?.substring(0, 6)}…${address?.substring(38)}`;
  return (
    <Group>
      <Code>
        {shortAddress}@{chainId}
      </Code>
      <Button onClick={() => disconnect()}>Disconnect</Button>
    </Group>
  );
}

function DoConnect() {
  const { connectors, connect, isPending } = useConnect();
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(
    () => connectors.map(({ uid, name }) => ({ value: uid, label: name })),
    [connectors],
  );

  const connector = useMemo(
    () =>
      selected ? connectors.find(({ uid }) => uid === selected) : connectors[0],
    [connectors, selected],
  );

  const onConnect = useCallback(() => {
    if (!connector) {
      throw new Error("unreachable!");
    }
    connect({ connector });
  }, [connect, connector]);

  return (
    <Box>
      <Select
        display={"inline-block"}
        style={{ marginTop: -2 }}
        px="lg"
        value={selected ?? connectors[0]?.uid}
        data={options}
        onChange={(value) => setSelected(value)}
      />
      <Button disabled={!connector || isPending} onClick={onConnect}>
        Connect
      </Button>
    </Box>
  );
}

export { Connect };
