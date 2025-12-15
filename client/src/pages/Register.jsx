import { useState } from "react";
import { api } from "../api";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");

    async function submit(e) {
        e.preventDefault();
        setErr("");
        try {
            await api.post("/api/auth/register", { email, password });
            nav("/login");
        } catch (e) {
            setErr(e.response?.data?.error || "Register failed");
        }
    }

    return (
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
            <h2>Register</h2>
            <form onSubmit={submit}>
                <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />
                <input placeholder="Password (min 8)" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />
                <button style={{ width: "100%", padding: 10 }}>Create account</button>
            </form>
            {err && <p style={{ color: "tomato" }}>{err}</p>}
            <p><Link to="/login">Login</Link></p>
        </div>
    );
}
