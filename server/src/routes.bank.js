const express = require("express");
const { body, validationResult } = require("express-validator");
const { pool } = require("./db");
const { requireAuth } = require("./auth");
const { toCents } = require("./money");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
    const [rows] = await pool.execute(
        `SELECT u.id as user_id, u.email, a.id as account_id, a.balance_cents
     FROM users u
     JOIN accounts a ON a.user_id = u.id
     WHERE u.id = ?`,
        [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Account not found" });
    res.json(rows[0]);
});

router.post(
    "/deposit",
    requireAuth,
    body("amount").exists(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        let amount_cents;
        try {
            amount_cents = toCents(req.body.amount);
            if (amount_cents <= 0) return res.status(400).json({ error: "Amount must be > 0" });
        } catch {
            return res.status(400).json({ error: "Invalid amount" });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [accRows] = await conn.execute(
                "SELECT id, balance_cents FROM accounts WHERE user_id = ? FOR UPDATE",
                [req.user.id]
            );
            const acc = accRows[0];
            if (!acc) return res.status(404).json({ error: "Account not found" });

            await conn.execute(
                "UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?",
                [amount_cents, acc.id]
            );

            await conn.execute(
                "INSERT INTO transactions (account_id, type, amount_cents) VALUES (?, 'deposit', ?)",
                [acc.id, amount_cents]
            );

            await conn.commit();

            res.json({ ok: true });
        } catch (err) {
            await conn.rollback();
            console.error(err);
            res.status(500).json({ error: "Server error" });
        } finally {
            conn.release();
        }
    }
);

router.post(
    "/transfer",
    requireAuth,
    body("toEmail").isEmail(),
    body("amount").exists(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { toEmail, note } = req.body;

        let amount_cents;
        try {
            amount_cents = toCents(req.body.amount);
            if (amount_cents <= 0) return res.status(400).json({ error: "Amount must be > 0" });
        } catch {
            return res.status(400).json({ error: "Invalid amount" });
        }

        if (toEmail === req.user.email) {
            return res.status(400).json({ error: "Cannot transfer to yourself" });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Find account ids (no locks yet)
            const [[fromAcc]] = await conn.execute(
                "SELECT id FROM accounts WHERE user_id = ?",
                [req.user.id]
            );
            if (!fromAcc) return res.status(404).json({ error: "Your account not found" });

            const [[toAcc]] = await conn.execute(
                `SELECT a.id
         FROM users u
         JOIN accounts a ON a.user_id = u.id
         WHERE u.email = ?`,
                [toEmail]
            );
            if (!toAcc) return res.status(404).json({ error: "Recipient not found" });

            // Lock both accounts in consistent order to avoid deadlocks
            const a = fromAcc.id;
            const b = toAcc.id;
            const low = Math.min(a, b);
            const high = Math.max(a, b);

            const [locked] = await conn.execute(
                "SELECT id, balance_cents FROM accounts WHERE id IN (?, ?) FOR UPDATE",
                [low, high]
            );

            const map = new Map(locked.map(r => [r.id, r]));
            const fromLocked = map.get(fromAcc.id);
            const toLocked = map.get(toAcc.id);

            if (!fromLocked || !toLocked) {
                return res.status(404).json({ error: "Account missing during transfer" });
            }

            if (fromLocked.balance_cents < amount_cents) {
                return res.status(400).json({ error: "Insufficient funds" });
            }

            await conn.execute(
                "UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?",
                [amount_cents, fromAcc.id]
            );
            await conn.execute(
                "UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?",
                [amount_cents, toAcc.id]
            );

            await conn.execute(
                `INSERT INTO transactions (account_id, type, amount_cents, counterparty_account_id, note)
         VALUES (?, 'transfer_out', ?, ?, ?)`,
                [fromAcc.id, amount_cents, toAcc.id, note || null]
            );
            await conn.execute(
                `INSERT INTO transactions (account_id, type, amount_cents, counterparty_account_id, note)
         VALUES (?, 'transfer_in', ?, ?, ?)`,
                [toAcc.id, amount_cents, fromAcc.id, note || null]
            );

            await conn.commit();
            res.json({ ok: true });
        } catch (err) {
            await conn.rollback();
            console.error(err);
            res.status(500).json({ error: "Server error" });
        } finally {
            conn.release();
        }
    }
);

router.get("/transactions", requireAuth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    const [[acc]] = await pool.execute(
        "SELECT id FROM accounts WHERE user_id = ?",
        [req.user.id]
    );
    if (!acc) return res.status(404).json({ error: "Account not found" });

    const [rows] = await pool.execute(
        `SELECT id, type, amount_cents, counterparty_account_id, note, created_at
     FROM transactions
     WHERE account_id = ?
     ORDER BY id DESC
     LIMIT ?`,
        [acc.id, limit]
    );

    res.json({ items: rows });
});

module.exports = { bankRouter: router };
