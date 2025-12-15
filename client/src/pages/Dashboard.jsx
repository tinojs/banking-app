import { useEffect, useState } from "react";
import { api } from "../api";

export default function Dashboard() {
    const [me, setMe] = useState(null);
    const [deposit, setDeposit] = useState("10");
    const [toEmail, setToEmail] = useState("");
    const [amount, setAmount] = useState("5");
    const [note, setNote] = useState("");
    const [tx, setTx] = useState([]);
    const [err, setErr] = useState("");

    async function load() {
        setErr("");
        const m = await api.get("/api/bank/me");
        setMe(m.data);
        const t = await api.get("/api/bank/transactions?limit=20");
        setTx(t.data.items);
    }

    useEffect(() => { load().catch(e => setErr(e.response?.data?.error || "Load failed")); }, []);

    async function doDeposit() {
        setErr("");
        try {
            await api.post("/api/bank/deposit", { amount: deposit });
            await load();
        } catch (e) {
            setErr(e.response?.data?.error || "Deposit failed");
        }
    }

    async function doTransfer() {
        setErr("");
        try {
            await api.post("/api/bank/transfer", { toEmail, amount, note });
            await load();
        } catch (e) {
            setErr(e.response?.data?.error || "Transfer failed");
        }
    }

    function logout() {
        localStorage.removeItem("token");
        location.href = "/login";
    }

    return (
        <div style={{ maxWidth: 800, margin: "40px auto" }}>
            <h2>Dashboard</h2>
            <button onClick={logout}>Logout</button>

            {me && (
                <div style={{ marginTop: 20 }}>
                    <p><b>Email:</b> {me.email}</p>
                    <p><b>Balance:</b> {(me.balance_cents / 100).toFixed(2)}</p>
                </div>
            )}

            <hr />

            <h3>Deposit</h3>
            <input value={deposit} onChange={e => setDeposit(e.target.value)} />
            <button onClick={doDeposit} style={{ marginLeft: 8 }}>Deposit</button>

            <hr />

            <h3>Transfer</h3>
            <input placeholder="toEmail" value={toEmail} onChange={e => setToEmail(e.target.value)} />
            <input placeholder="amount" value={amount} onChange={e => setAmount(e.target.value)} style={{ marginLeft: 8 }} />
            <input placeholder="note" value={note} onChange={e => setNote(e.target.value)} style={{ marginLeft: 8 }} />
            <button onClick={doTransfer} style={{ marginLeft: 8 }}>Send</button>

            {err && <p style={{ color: "tomato" }}>{err}</p>}

            <hr />

            <h3>Recent transactions</h3>
            <ul>
                {tx.map(x => (
                    <li key={x.id}>
                        #{x.id} — {x.type} — {(x.amount_cents / 100).toFixed(2)} — {new Date(x.created_at).toLocaleString()}
                    </li>
                ))}
            </ul>
        </div>
    );
}
