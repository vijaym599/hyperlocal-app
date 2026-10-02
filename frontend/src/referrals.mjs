export const formatMoney = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise) / 100);
export const referralFromSearch = (search = '') => {
  const code = (new URLSearchParams(search).get('ref') || '').trim().toUpperCase();
  return /^NB[A-F0-9]{24}$/.test(code) ? code : '';
};
export const referralLink = (origin, code) => {
  const url = new URL('/', origin); url.searchParams.set('ref', code); return url.href;
};
export const referralStatus = { pending_verification: 'Payment review pending', available: 'Reward credited', pending: 'Awaiting admin approval', approved: 'Approved · awaiting payout', rejected: 'Rejected', paid: 'Paid' };
