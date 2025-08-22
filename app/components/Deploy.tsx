import {
  Alert,
  Card,
  Center,
  Code,
  Group,
  Loader,
  Notification,
  Stack,
  Stepper,
  Text,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  type Address,
  formatEther,
  type TransactionRequestEIP7702,
} from "viem";
import { useAccount, useDeployContract, useSendTransaction } from "wagmi";
import { Copy } from "@/components/Copy.tsx";
import { TransactionButton } from "@/components/TransactionButton.tsx";
import { getBurnerPrivateKey, useBurnerAccount } from "@/contexts/Burner.tsx";
import { bootstrap } from "@/erc-7955.ts";
import { useBootstrapContract } from "@/hooks/useBootstrapContract.ts";
import { useBurnerMissingFunds } from "@/hooks/useBurnerMissingFunds.ts";
import { useDeployFactoryTransaction } from "@/hooks/useDeployFactoryTransaction.ts";
import { useFactoryDeployed } from "@/hooks/useFactoryDeployed.ts";

function DeployBootstrap({
  onDeployed,
}: {
  onDeployed: (result: { address: Address }) => void;
}) {
  const { deployContract, isPending, error, reset } = useDeployContract();

  return (
    <Stack>
      <Text>
        The bootstrapping contract is used as an EIP-7702 delegation target for
        the permissionless CREATE2 factory contract deployment needs to be
        deployed.
      </Text>
      <TransactionButton
        text="Deploy"
        description="deploy the bootstrap contract"
        onTransaction={(options) => deployContract(bootstrap, options)}
        isPending={isPending}
        error={error}
        onReset={reset}
        onConfirmed={({ contractAddress }) => {
          if (contractAddress) {
            onDeployed({ address: contractAddress });
          }
        }}
      />
    </Stack>
  );
}

function FundBurner({
  bootstrap,
  funding,
}: {
  bootstrap: Address;
  funding: { balance: bigint; missingFunds: bigint } | null;
}) {
  const { address } = useBurnerAccount();
  const privateKey = getBurnerPrivateKey();
  const { sendTransaction, isPending, error, reset } = useSendTransaction();
  const balance = funding?.balance;
  const missingFunds = funding?.missingFunds;

  return (
    <Stack>
      <Text>
        The permissionless CREATE2 factory can be deployed by anyone with the
        bootstrapping contract <Code>{bootstrap}</Code>.
      </Text>
      <Text>
        Unfortunately, most wallets do not support EIP-7702 type{" "}
        <Code>0x4</Code>
        transactions. In order to proceed with the deployment, a burner account
        needs be funded to execute the permissionless CREATE2 factory
        deployment.
      </Text>
      <Card shadow="sm" p="sm" radius="md" withBorder>
        <Card.Section>
          <Text ml="lg" m="md" fw={700}>
            Burner account
          </Text>
        </Card.Section>
        <Stack m="xs" gap="xs">
          <Group justify="space-between">
            <Text size="sm">
              Address:
              <Code>{address}</Code>
            </Text>
            <Copy value={address} />
          </Group>
          <Group justify="space-between">
            <Text size="sm">
              Private key:
              <Code style={{ filter: "blur(3px)", userSelect: "none" }}>
                {privateKey}
              </Code>
            </Text>
            <Copy value={privateKey} />
          </Group>
          <Group align="center">
            <Text size="sm">
              Balance:{" "}
              {balance !== undefined && <Code>Ξ{formatEther(balance)}</Code>}
            </Text>
            {balance === undefined && <Loader size="xs" color="gray" />}
          </Group>
          <Group align="center">
            <Text size="sm">
              Topup:{" "}
              {missingFunds !== undefined && (
                <Code>Ξ{formatEther(missingFunds)}</Code>
              )}
            </Text>
            {missingFunds === undefined && <Loader size="xs" color="gray" />}
          </Group>
        </Stack>
      </Card>
      <Alert icon={"⚠"} title="Warning" color="yellow">
        The private key for your burner wallet is <i>insecurely</i> stored in
        the browser's local storage. DO NOT send additional tokens to the
        account!
      </Alert>
      <TransactionButton
        text="Fund"
        description="fund the burner account"
        disabled={!missingFunds}
        onTransaction={(options) =>
          sendTransaction(
            {
              to: address,
              value: missingFunds ?? 0n,
            },
            options,
          )
        }
        isPending={isPending}
        error={error}
        onReset={reset}
      />
    </Stack>
  );
}

function DeployFactory({
  transaction,
  onDeployed,
}: {
  transaction: TransactionRequestEIP7702 | null;
  onDeployed: () => void;
}) {
  const burner = useBurnerAccount();
  const { sendTransaction, isPending, error, reset } = useSendTransaction();

  return (
    <Stack>
      <Text>
        The bootstrapping contract is used as an EIP-7702 delegation target for
        the permissionless CREATE2 factory contract deployment from your burner
        account.
      </Text>
      <TransactionButton
        text="Deploy"
        description="deploy the CREATE2 factory"
        disabled={!transaction}
        onTransaction={(options) =>
          sendTransaction(
            {
              account: burner,
              ...transaction,
            },
            options,
          )
        }
        isPending={isPending}
        error={error}
        onReset={reset}
        onConfirmed={onDeployed}
      />
    </Stack>
  );
}

function Deployed() {
  return (
    <Text>The permissionless CREATE2 factory is successfully deployed!</Text>
  );
}

function Deploy() {
  const { status } = useAccount();
  return status === "connected" ? <Connected /> : <NotConnected />;
}

function Connected() {
  const bootstrap = useBootstrapContract();
  const transaction = useDeployFactoryTransaction({ bootstrap });
  const funding = useBurnerMissingFunds({ transaction });
  const factory = useFactoryDeployed();

  const isPending =
    bootstrap.isLoading || funding.isLoading || factory.isPending;
  const active = factory.data
    ? 3
    : funding.data?.missingFunds === 0n
      ? 2
      : bootstrap.address
        ? 1
        : 0;

  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    if (!isPending) {
      setFirstLoad(false);
    }
  }, [isPending]);

  return firstLoad ? (
    <Center>
      <Loader />
    </Center>
  ) : (
    <Stack>
      <Stepper active={active}>
        <Stepper.Step
          label="Bootstrap"
          description="deploy bootstrapping contract"
        >
          <DeployBootstrap onDeployed={bootstrap.deployed} />
        </Stepper.Step>
        <Stepper.Step label="Fund" description="fund a burner account">
          <FundBurner
            bootstrap={bootstrap.address ?? `0x${"00".repeat(20)}`}
            funding={funding.data ?? null}
          />
        </Stepper.Step>
        <Stepper.Step label="Deploy" description="deploy the CREATE2 factory">
          <DeployFactory
            transaction={transaction}
            onDeployed={() => factory.refetch()}
          />
        </Stepper.Step>
        <Stepper.Completed>
          <Deployed />
        </Stepper.Completed>
      </Stepper>
      {funding.error && (
        <Notification
          color="red"
          title="Error fetching burner account information"
        >
          {funding.error.message}
        </Notification>
      )}
      {factory.error && (
        <Notification
          color="red"
          title="Error fetching CREATE2 factory deployment status"
        >
          {factory.error.message}
        </Notification>
      )}
    </Stack>
  );
}

function NotConnected() {
  return <Text>Connect your wallet to continue.</Text>;
}

export { Deploy };
