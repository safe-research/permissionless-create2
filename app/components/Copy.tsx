import { Badge, CopyButton, UnstyledButton } from "@mantine/core";

function Copy({ value }: { value: string }) {
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <UnstyledButton onClick={copy}>
          <Badge color="gray">{copied ? "copied!" : "copy"}</Badge>
        </UnstyledButton>
      )}
    </CopyButton>
  );
}

export { Copy };
