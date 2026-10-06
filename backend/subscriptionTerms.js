const MONTHLY_PRICES = Object.freeze({ basic: 20, pro: 199, advance: 499, enterprise: 999 });

function subscriptionTerms(plan) {
  if (!Object.hasOwn(MONTHLY_PRICES, plan)) throw new Error('Invalid subscription plan.');
  const months = plan === 'basic' ? 6 : 1;
  return { months, days: months * 30, amountPaise: MONTHLY_PRICES[plan] * months * 100 };
}

module.exports = { subscriptionTerms };
