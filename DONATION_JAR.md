# Donation Jar Feature

A simple, non-intrusive donation system for your IPTV application.

## Features

✅ **Always Accessible, Never Auto-Opens**
- User must explicitly open it
- No popups, reminders, or timers
- Respectful and opt-in

✅ **Multiple Access Methods**
- Menu: **Help → Donate**
- Keyboard: **Ctrl+D**
- Opens as modal overlay

✅ **External Links Only**
- Uses `shell.openExternal()` for safety
- No embedded webviews
- No in-app payment processing
- Links open in default browser

✅ **Support Multiple Payment Methods**
- PayPal
- Ko-fi
- Buy Me a Coffee
- Optional crypto addresses (BTC, ETH)

✅ **Privacy-First**
- No tracking
- No data collection
- No analytics
- Minimal config storage

✅ **Non-Disruptive**
- Does not pause playback
- Does not interfere with app functionality
- Easy to close (ESC key)

## Setup Instructions

### 1. Configure Your Donation URLs

Edit the donation methods in `src/components/DonationJar.tsx`:

```typescript
const donationMethods: DonationMethod[] = [
  {
    name: 'PayPal',
    url: 'https://paypal.me/YOUR_PAYPAL_USERNAME', // ← Change this
    type: 'link'
  },
  {
    name: 'Ko-fi',
    url: 'https://ko-fi.com/YOUR_KOFI_USERNAME', // ← Change this
    type: 'link'
  },
  {
    name: 'Buy Me a Coffee',
    url: 'https://buymeacoffee.com/YOUR_COFFEE_USERNAME', // ← Change this
    type: 'link'
  },
  // Optional: Uncomment and add crypto addresses
  // {
  //   name: 'Bitcoin (BTC)',
  //   address: 'YOUR_BTC_ADDRESS',
  //   type: 'crypto'
  // },
];
```

### 2. Customize the Message (Optional)

Edit the thank you message in `src/components/DonationJar.tsx`:

```typescript
<p className={styles.message}>
  Enjoying the app? Your support helps keep this project alive and improving.
  Every contribution is appreciated! 🙏
</p>
```

### 3. Remove Unused Payment Methods (Optional)

To remove a payment method, simply delete or comment out its entry in the `donationMethods` array.

## Usage

### For Users

**Opening the Donation Jar:**
1. Press **Ctrl+D** on keyboard
2. Or go to **Help → Donate** in menu (press Alt to show menu)

**Making a Donation:**
1. Click on your preferred donation method
2. Your browser will open with the donation page
3. Complete donation in browser

**Crypto Donations (if enabled):**
1. Click "Copy Address" button
2. Paste address in your crypto wallet
3. Send desired amount

**Closing:**
- Click **×** button
- Press **ESC** key
- Click outside the modal

### For Developers

**Testing:**
```bash
npm run dev
# Press Ctrl+D to test the donation modal
```

**Accessing from Code:**
```typescript
// The donation state is managed in App.tsx
const [showDonationJar, setShowDonationJar] = useState(false);

// Open donation modal
setShowDonationJar(true);

// Close donation modal
setShowDonationJar(false);
```

## Files Created/Modified

### New Files
- `src/components/DonationJar.tsx` - Main donation modal component
- `src/components/DonationJar.module.css` - Styling
- `src/types/donation.ts` - Type definitions (for future config expansion)
- `DONATION_JAR.md` - This documentation

### Modified Files
- `electron/preload.ts` - Added `shell.openExternal` and IPC listeners
- `electron/main.ts` - Added shell import, IPC handler, and menu item
- `src/App.tsx` - Added Ctrl+D shortcut and menu listener
- `src/types/electron.d.ts` - Added shell and ipcRenderer types

## Architecture

```
User Action (Ctrl+D or Menu)
    ↓
App.tsx (State: showDonationJar)
    ↓
DonationJar Component (Modal)
    ↓
User Clicks Donation Method
    ↓
window.electron.shell.openExternal(url)
    ↓
IPC → Main Process
    ↓
shell.openExternal(url)
    ↓
Opens in Default Browser
```

## Safety & Privacy

### What This Feature Does NOT Do:
❌ Auto-open or show reminders
❌ Track user behavior
❌ Collect personal data
❌ Send analytics
❌ Require registration
❌ Process payments in-app
❌ Use embedded webviews
❌ Interrupt playback
❌ Add ads or paywalls

### What This Feature DOES:
✅ Opens external browser for security
✅ Uses Electron's safe `shell.openExternal()`
✅ Stores only donation URLs (no user data)
✅ Respects user's choice to ignore
✅ Provides copy-to-clipboard for crypto (client-side only)

## Customization Guide

### Change Modal Theme

Edit `src/components/DonationJar.module.css`:

```css
.donationJar {
  background: linear-gradient(to bottom, #1a1a1a, #0f0f0f); /* Dark theme */
  border: 1px solid #333;
  border-radius: 16px;
}
```

### Add More Payment Methods

Add to the `donationMethods` array:

```typescript
{
  name: 'Patreon',
  url: 'https://patreon.com/yourusername',
  type: 'link'
},
{
  name: 'GitHub Sponsors',
  url: 'https://github.com/sponsors/yourusername',
  type: 'link'
}
```

### Change Button Colors

Edit `src/components/DonationJar.module.css`:

```css
.donateButton {
  background: linear-gradient(135deg, #4a9eff, #357abd); /* Blue gradient */
}

/* For a different color scheme: */
.donateButton {
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a); /* Red gradient */
}
```

### Disable Keyboard Shortcut

Comment out in `src/App.tsx`:

```typescript
// Ctrl+D for donation jar
// if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
//   e.preventDefault();
//   setShowDonationJar(prev => !prev);
//   return;
// }
```

### Disable Menu Item

Comment out in `electron/main.ts`:

```typescript
// {
//   label: 'Donate',
//   accelerator: 'CmdOrCtrl+D',
//   click: () => {
//     mainWindow?.webContents.send('menu:openDonation');
//   }
// },
```

## Future Enhancements (Optional)

If you want to expand the feature later, you could add:

1. **Donation Goal Progress Bar**
   - Display funding goal and progress
   - Purely informational, no pressure

2. **Donation History (Local)**
   - Track user's own donations (client-side only)
   - No server communication

3. **Custom Thank You Messages**
   - Personalized messages for different tiers
   - Show supporter names (with permission)

4. **Alternative Payment Methods**
   - Add regional payment methods (Alipay, WeChat Pay, etc.)
   - QR codes for mobile payments

5. **Offline Mode**
   - Show donation info even without internet
   - QR codes generated locally

## Compliance Notes

### GDPR Compliance
✅ No personal data collected
✅ No cookies or tracking
✅ External links clearly indicated
✅ User must explicitly opt-in

### Electron Security
✅ Uses `contextIsolation: true`
✅ Uses `nodeIntegration: false`
✅ Uses `shell.openExternal()` (safe)
✅ No eval() or remote code execution

### Payment Processing
✅ All processing handled by third-party platforms
✅ App never handles payment credentials
✅ App never stores financial information
✅ No PCI DSS compliance needed

## Troubleshooting

### Issue: External links not opening
**Solution:** Check that `shell.openExternal` is properly exposed in preload.ts and the IPC handler is registered in main.ts.

### Issue: Ctrl+D not working
**Solution:** Make sure the keyboard event handler is registered and not being intercepted by another component.

### Issue: Menu not showing
**Solution:** Press Alt key to show the menu bar. It's set to `autoHideMenuBar: true`.

### Issue: Copy to clipboard fails (crypto)
**Solution:** The app needs HTTPS or localhost for clipboard API. This works in dev mode and production.

## Support

If you encounter issues with the donation feature:
1. Check browser console for errors
2. Verify donation URLs are valid
3. Test in development mode first
4. Check Electron main process logs

## License

This donation feature is part of your IPTV application and follows the same license.

---

**Remember:** This feature is designed to be respectful and non-intrusive. Users who want to support you will find it easily, and those who don't won't be bothered by it.

Happy receiving! 🙏💝
