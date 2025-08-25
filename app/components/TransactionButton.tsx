import { Button, Group, Loader, Notification, Space } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import type { Hex, TransactionReceipt } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";

function Confirming({
  hash,
  onConfirmed,
}: {
  hash: Hex;
  onConfirmed: (receipt: TransactionReceipt | null) => void;
}) {
  const { data, status } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (status === "success") {
      onConfirmed(data ?? null);
    } else if (status === "error") {
      onConfirmed(null);
    }
  }, [data, status, onConfirmed]);

  return (
    <Button disabled={true}>
      {status === "pending" && (
        <>
          <Loader color="gray" size="xs" />
          <Space w="sm" />
          Confirming
        </>
      )}
      {status === "success" && "Confirmed"}
      {status === "error" && "Reverted"}
    </Button>
  );
}

function TransactionButton({
  text,
  description,
  disabled,
  onTransaction,
  isPending,
  error,
  onReset,
  onConfirmed,
}: {
  text: string;
  description?: string;
  disabled?: boolean;
  onTransaction: (options: { onSuccess: (hash: Hex) => void }) => void;
  isPending: boolean;
  error: Error | null;
  onReset: () => void;
  onConfirmed?: (receipt: TransactionReceipt) => void;
}) {
  const [hash, setHash] = useState<Hex | null>(null);
  const [reverted, setReverted] = useState(false);
  const errorTitle = `Failed to ${description ?? "execute transaction"}`;

  const send = useCallback(() => {
    setReverted(false);
    onTransaction({
      onSuccess: (hash) => setHash(hash),
    });
  }, [onTransaction]);

  const confirm = useCallback(
    (receipt: TransactionReceipt | null) => {
      if (receipt) {
        onConfirmed?.(receipt);
      }

      if (receipt?.status === "success") {
        // Set a grace period to linger with the "Confirmed" disabled button.
        // This gives feedback to the user that the transaction succeeded, while
        // preventing the transaction button from "flashing" back to enabled in
        // the time it takes for block chain state to propagate through the app.
        setTimeout(() => setHash(null), 15000);
      } else {
        setHash(null);
        setReverted(false);
      }
    },
    [onConfirmed],
  );

  return (
    <>
      <Group justify="flex-end">
        {hash ? (
          <Confirming hash={hash} onConfirmed={confirm} />
        ) : (
          <Button disabled={disabled === true || isPending} onClick={send}>
            {text}
          </Button>
        )}
      </Group>
      {error && (
        <Notification color="red" title={errorTitle} onClose={onReset}>
          {error.message}
        </Notification>
      )}
      {reverted && (
        <Notification
          color="red"
          title={errorTitle}
          onClose={() => setReverted(false)}
        >
          Transaction reverted.
        </Notification>
      )}
    </>
  );
}

export { TransactionButton };
