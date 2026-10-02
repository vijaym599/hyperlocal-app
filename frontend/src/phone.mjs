export const indianLocalPhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
};

export const indianPhoneE164 = (value) => {
  const local = indianLocalPhone(value);
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : '';
};
