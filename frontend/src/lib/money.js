// Money as it is written and as it is typed. Amounts are plain numbers, as the API keeps them;
// the currency is the account's own (rupees unless it says otherwise).

import { readAmount } from "./itemForm";

export const DEFAULT_CURRENCY = "INR";

// The largest amount the API takes
export const MOST_MONEY = 1000000000000;

// Rupees are grouped the Indian way (1,00,000); anything else the way the reader's own locale does it
const localeFor = (currency) => (currency === "INR" ? "en-IN" : undefined);

const formats = new Map();

const formatFor = (currency, options, name) => {
    const key = `${currency}:${name}`;
    if (!formats.has(key)) {
        formats.set(key, new Intl.NumberFormat(localeFor(currency), { style: "currency", currency, ...options }));
    }
    return formats.get(key);
};

// "₹1,250", or "₹1,250.50" when there is a part of a rupee to show. An overdrawn "−₹45" has a real minus sign.
export const formatMoney = (amount = 0, currency = DEFAULT_CURRENCY) => {
    const value = Number(amount) || 0;
    const size = Math.abs(value);
    const written = Number.isInteger(size)
        ? formatFor(currency, { maximumFractionDigits: 0 }, "whole").format(size)
        : formatFor(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, "exact").format(size);

    return value < 0 ? `−${written}` : written;
};

// "+₹62,000" and "−₹420": the sign always written, the minus as wide as the plus
export const signedMoney = (amount, currency = DEFAULT_CURRENCY) =>
    amount < 0 ? formatMoney(amount, currency) : `+${formatMoney(amount, currency)}`;

// "₹20K": for the scale of a chart, where there is no room for the whole figure
export const compactMoney = (amount, currency = DEFAULT_CURRENCY) =>
    formatFor(currency, { notation: "compact", maximumFractionDigits: 1 }, "compact").format(Number(amount) || 0);

// The sign a currency is written with ("₹"), to stand inside a field before the figure
export const currencySign = (currency = DEFAULT_CURRENCY) =>
    formatFor(currency, { maximumFractionDigits: 0 }, "whole")
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency;

// An amount as typed ("1250", "1,250.50", "₹ 1,250"), as a number rounded to the paisa, or NaN
export const readMoney = (text) => {
    const amount = readAmount(String(text ?? "").replace(/[^\d.,\s-]/g, ""));
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
};

// An amount as it is put back into a field: no sign, no grouping
export const writeMoney = (amount) => (amount === null || amount === undefined ? "" : String(Number(amount) || 0));
