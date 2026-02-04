export interface DonationConfig {
  // Optional flag to track if user has seen the donation info (NOT for reminders)
  hasSeenDonation?: boolean;
  
  // Last time donation UI was opened (for optional analytics, NOT for reminders)
  lastOpened?: number;
  
  // User can set donation URLs here (editable in settings if needed)
  paypalUrl?: string;
  kofiUrl?: string;
  coffeeUrl?: string;
  btcAddress?: string;
  ethAddress?: string;
}

export const DEFAULT_DONATION_CONFIG: DonationConfig = {
  hasSeenDonation: false,
  paypalUrl: 'https://paypal.me/yourpaypalname',
  kofiUrl: 'https://ko-fi.com/yourkofiname',
  coffeeUrl: 'https://buymeacoffee.com/yourcoffeename',
  // btcAddress: 'bc1qyourbtcaddress',
  // ethAddress: '0xyourethaddress',
};
