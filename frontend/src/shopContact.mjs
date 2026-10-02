const phoneNumber = value => {
  const compact = String(value || '').trim().replace(/[\s().-]/g, '');
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
};

export function shopContactLinks(shop) {
  const phone = phoneNumber(shop.phone);
  const whatsapp = phoneNumber(shop.whatsapp_number);
  let directions = null;
  const lat = Number(shop.latitude), lng = Number(shop.longitude);
  if (shop.latitude != null && shop.latitude !== '' && shop.longitude != null && shop.longitude !== '' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else {
    try {
      const map = new URL(shop.google_map_link);
      if (['https:', 'http:'].includes(map.protocol)) directions = map.href;
    } catch { /* Fall back to the shop address. */ }
    if (!directions && shop.address) directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name || ''} ${shop.address}`)}`;
  }
  return {
    call: phone ? `tel:${phone}` : null,
    whatsapp: whatsapp ? `https://wa.me/${whatsapp.slice(1)}?text=${encodeURIComponent(`Hi, I found ${shop.name || 'your shop'} on Nearbuy. Could you confirm your opening hours and product availability?`)}` : null,
    directions,
  };
}
