// Abodex shared loan maths, used by every calculator page.

// Standard fixed-rate payment: P * r / (1 - (1+r)^-n)
function monthlyPI(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r / (1 - Math.pow(1 + r, -months));
}

// Loan balance left after `paid` regular monthly payments, walked month by month.
function balanceAfter(principal, annualRate, months, paid) {
  const r = annualRate / 100 / 12, payment = monthlyPI(principal, annualRate, months);
  let balance = principal;
  for (let m = 1; m <= Math.min(paid, months) && balance > 0.005; m++) {
    balance -= Math.min(payment - balance * r, balance);
  }
  return Math.max(balance, 0);
}
