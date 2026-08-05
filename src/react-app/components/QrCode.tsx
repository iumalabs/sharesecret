import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
}

export default function QrCode({ value, size = 160 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      // Dark modules on a dark background feels wrong for a QR code at
      // first glance, but every other panel on this page is dark with a
      // purple accent -- a stark white square here reads as unstyled, not
      // intentional. The accent color still has plenty of luminance
      // contrast against --bg to stay reliably scannable.
      color: { dark: "#a78bfa", light: "#070615" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) return <div className="qr-frame" style={{ width: size, height: size }} aria-hidden="true" />;

  return (
    <img
      className="qr-frame"
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code encoding the one-time secret link, including its decryption key"
    />
  );
}
