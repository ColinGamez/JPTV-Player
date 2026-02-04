import React, { useState } from 'react';
import styles from './DonationJar.module.css';

interface DonationMethod {
  name: string;
  url?: string;
  address?: string;
  type: 'link' | 'crypto';
}

interface DonationJarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonationJar: React.FC<DonationJarProps> = ({ isOpen, onClose }) => {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const donationMethods: DonationMethod[] = [
    {
      name: 'PayPal',
      url: 'https://paypal.me/yourpaypalname', // TODO: Replace with your PayPal URL
      type: 'link'
    },
    {
      name: 'Ko-fi',
      url: 'https://ko-fi.com/yourkofiname', // TODO: Replace with your Ko-fi URL
      type: 'link'
    },
    {
      name: 'Buy Me a Coffee',
      url: 'https://buymeacoffee.com/yourcoffeename', // TODO: Replace with your Buy Me a Coffee URL
      type: 'link'
    },
    // Crypto addresses (optional - uncomment and replace addresses if needed)
    // {
    //   name: 'Bitcoin (BTC)',
    //   address: 'bc1qyourbtcaddress', // TODO: Replace with your BTC address
    //   type: 'crypto'
    // },
    // {
    //   name: 'Ethereum (ETH)',
    //   address: '0xyourethaddress', // TODO: Replace with your ETH address
    //   type: 'crypto'
    // },
  ];

  const handleOpenLink = (url: string) => {
    if (window.electron?.shell) {
      window.electron.shell.openExternal(url);
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.donationJar} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>☕ Support Development</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            title="閉じる (ESC)"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>
            Enjoying the app? Your support helps keep this project alive and improving.
            Every contribution is appreciated! 🙏
          </p>

          <div className={styles.methods}>
            {donationMethods.map((method) => (
              <div key={method.name} className={styles.methodCard}>
                {method.type === 'link' && method.url ? (
                  <>
                    <div className={styles.methodName}>{method.name}</div>
                    <button
                      className={styles.donateButton}
                      onClick={() => handleOpenLink(method.url!)}
                    >
                      <span className={styles.externalIcon}>🔗</span>
                      Donate via {method.name}
                    </button>
                    <div className={styles.externalNote}>Opens in browser</div>
                  </>
                ) : method.type === 'crypto' && method.address ? (
                  <>
                    <div className={styles.methodName}>{method.name}</div>
                    <div className={styles.cryptoAddress}>
                      <code>{method.address}</code>
                    </div>
                    <button
                      className={`${styles.copyButton} ${
                        copiedAddress === method.address ? styles.copied : ''
                      }`}
                      onClick={() => handleCopyAddress(method.address!)}
                    >
                      {copiedAddress === method.address ? (
                        <>
                          <span>✓</span> Copied!
                        </>
                      ) : (
                        <>
                          <span>📋</span> Copy Address
                        </>
                      )}
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <p className={styles.disclaimer}>
              🔒 No payment processing happens in this app. All links open in your external browser.
            </p>
            <p className={styles.thankyou}>
              Thank you for your support! ❤️
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
