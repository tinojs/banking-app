const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { pool } = require("./db");

const router = express.Router();

router.post(
    "/register",
    body("email").isEmail(),
    body("password").isLength({ min: 8 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { email, password } = req.body;

        try {
            const password_hash = await bcrypt.hash(password, 12);

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                const [userInsert] = await conn.execute(
                    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                    [email, password_hash]
                );

                await conn.execute(
                    "INSERT INTO accounts (user_id, balance_cents) VALUES (?, 0)",
                    [userInsert.insertId]
                );

                await conn.commit();
            } catch (e) {
                await conn.rollback();
                if (e.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ error: "Email already registered" });
                }
                throw e;
            } finally {
                conn.release();
            }

            return res.status(201).json({ ok: true });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Server error" });
        }
    }
);

router.post(
    "/login",
    body("email").isEmail(),
    body("password").isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { email, password } = req.body;

        try {
            const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
            const user = rows[0];
            if (!user) return res.status(401).json({ error: "Invalid credentials" });

            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) return res.status(401).json({ error: "Invalid credentials" });

            const token = jwt.sign(
                { id: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            return res.json({ token });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Server error" });
        }
    }
);

module.exports = { authRouter: router };
