require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { authRouter } = require("./routes.auth");
const { bankRouter } = require("./routes.bank");

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/bank", bankRouter);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
