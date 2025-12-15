function toCents(input) {
    const s = String(input).trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Invalid amount format");

    const [whole, frac = ""] = s.split(".");
    const cents = parseInt((frac + "00").slice(0, 2), 10);

    return parseInt(whole, 10) * 100 + cents;
}

module.exports = { toCents };
