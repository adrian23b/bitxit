import express from "express";
import { execFile } from "node:child_process";

const PORT = 3002;
const PROVEEDOR = "http://localhost:3001";
const TOPE = process.env.TOPE || "$0.02";
const historial = [];
let ocupado = false; // una compra a la vez

async function saldoUSDC() {
  const r = await fetch(`https://horizon-testnet.stellar.org/accounts/${process.env.AGENTE_PUBLICA}`);
  const b = (await r.json()).balances.find((x) => x.asset_code === "USDC");
  return b ? Number(b.balance) : 0;
}

async function catalogo() {
  const r = await fetch(`${PROVEEDOR}/catalogo`);
  return (await r.json()).servicios;
}

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Estado del panel: catálogo, saldo, tope e historial. No contiene ninguna llave secreta.
app.get("/api/estado", async (_, res) => {
  try {
    res.json({
      agente: process.env.AGENTE_PUBLICA,
      tope: TOPE,
      saldo: await saldoUSDC(),
      servicios: await catalogo(),
      historial,
    });
  } catch {
    res.status(502).json({ error: "No se pudo leer el catálogo o el saldo. ¿Está prendido el proveedor (npm run api)?" });
  }
});

// El agente compra un servicio: se ejecuta agente.js, el mismo de la terminal
app.post("/api/comprar", async (req, res) => {
  if (ocupado) return res.status(429).json({ error: "El agente está ocupado con otra compra." });
  ocupado = true;
  try {
    const id = String(req.body?.id || "");
    const servicios = await catalogo().catch(() => []);
    if (!servicios.some((s) => s.id === id)) return res.status(400).json({ error: "Servicio no válido." });

    const salida = await new Promise((resolve) => {
      execFile(
        process.execPath,
        ["--env-file=.env", "agente.js", id],
        { timeout: 90000 },
        (err, stdout, stderr) => resolve({ ok: !err, texto: `${stdout}${stderr}` }),
      );
    });

    const hash = salida.ok ? (salida.texto.match(/[0-9a-f]{64}/g) || []).pop() || null : null;
    const compra = { id, ok: salida.ok, hash, hora: new Date().toISOString() };
    historial.unshift(compra);
    historial.length = Math.min(historial.length, 20);
    res.json({ ...compra, salida: salida.texto });
  } finally {
    ocupado = false;
  }
});

app.listen(PORT, () => console.log(`Panel del agente en http://localhost:${PORT}`));
