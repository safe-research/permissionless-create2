import { useQuery } from "@tanstack/react-query";
import { formatTransactionRequest, type TransactionRequestEIP7702 } from "viem";
import { estimateGas, getBalance, getGasPrice } from "viem/actions";
import { useClient } from "wagmi";
import { useBurnerAccount } from "@/contexts/Burner";

const scale = {
  base: 10n,
  check: 15n,
  fund: 20n,
};

function useBurnerMissingFunds({
  transaction,
}: {
  transaction: TransactionRequestEIP7702 | null;
}) {
  const client = useClient();
  const burner = useBurnerAccount();

  return useQuery({
    queryKey: [
      "burner:missing-funds",
      burner.address,
      `${client?.chain?.id}`,
      JSON.stringify(formatTransactionRequest(transaction ?? {})),
    ],
    queryFn: async () => {
      if (!client || !transaction) {
        return null;
      }

      const gas = await estimateGas(client, {
        ...transaction,
        account: burner,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
      });
      const gasPrice = await getGasPrice(client);
      const balance = await getBalance(client, burner);

      let missingFunds: bigint;
      if (gas * gasPrice * scale.check < balance) {
        missingFunds = 0n;
      } else {
        missingFunds = gas * gasPrice * scale.fund - balance;
      }

      return { balance, missingFunds };
    },
    enabled: !!client,
    staleTime: 1000,
    refetchInterval: 1000,
  });
}

export { useBurnerMissingFunds };
