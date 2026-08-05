import { useState } from "react";
import CopyIcon from "./CopyIcon";

interface CopyButtonProps {
  value: string;
  label: string;
  copiedLabel?: string;
  className: string;
  icon?: boolean;
}

export default function CopyButton({ value, label, copiedLabel = "✓ Copied", className, icon }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {icon && (
        <span className="btn-icon-row">
          <CopyIcon />
          {copied ? copiedLabel : label}
        </span>
      )}
      {!icon && (copied ? copiedLabel : label)}
    </button>
  );
}
