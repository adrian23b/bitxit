import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const BASE = "http://localhost:3001";
const NETWORK = "stellar:testnet";
const ID = process.argv[2] || "dato";
const TOPE = process.env.TOPE || "$0.02"; // lo máximo que el agente paga por UNA compra
const INTENTOS = 3; // reintentos solo si el proveedor no responde, nunca después de pagar

const signer = createEd25519Signer(process.env.AGENTE_SECRETA, NETWORK);
const client = x402Client.fromConfig({
  schemes: [{ network: "stellar:*", client: new ExactStellarScheme(signer, { url: "https://soroban-testnet.stellar.org" }) }],
  spendControls: { maxAmountPerPayment: TOPE },
});
const http = new x402HTTPClient(client);
const fetchQuePaga = wrapFetchWithPayment(fetch, client);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Saldo USDC del agente en unidades de 7 decimales (0.01 USDC = 100000)
async function saldoUSDC() {
  const r = await fetch(`https://horizon-testnet.stellar.org/accounts/${signer.address}`);
  const b = (await r.json()).balances.find((x) => x.asset_code === "USDC");
  return b ? Math.round(Number(b.balance) * 1e7) : 0;
}

// Repite una petición que NO paga, con espera creciente (1 s, 2 s)
async function conReintentos(fn) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch {
      if (i === INTENTOS) {
        console.log(`❌ El proveedor no responde después de ${INTENTOS} intentos. No se pagó nada.`);
        process.exit(1);
      }
      console.log(`El proveedor no responde (intento ${i}/${INTENTOS}), reintento en ${i}s…`);
      await esperar(i * 1000);
    }
  }
}

// 1. Lee el catálogo (gratis) y busca el servicio
const catalogo = await conReintentos(async () => (await fetch(`${BASE}/catalogo`)).json());
const servicio = catalogo.servicios.find((s) => s.id === ID);
if (!servicio) {
  console.log(`❌ No existe el servicio "${ID}". Hay: ${catalogo.servicios.map((s) => s.id).join(", ")}`);
  process.exit(1);
}
const url = new URL(servicio.ruta, BASE);
if (ID === "resumen") url.searchParams.set("texto", "bitxit es un mercado donde agentes se compran servicios con micropagos");

// 2. Pregunta el precio SIN pagar
const r = await conReintentos(() => fetch(url.toString()));
if (r.status !== 402) {
  console.log(`La ruta no cobra (status ${r.status}).`);
  process.exit(0);
}
const precio = Number(http.getPaymentRequiredResponse((h) => r.headers.get(h)).accepts[0].amount);

// 3. Antes de firmar: ¿alcanza el saldo?
const saldo = await saldoUSDC();
console.log(`🤖 Agente ${signer.address}`);
console.log(`Servicio: ${servicio.id} · precio ${precio / 1e7} USDC · saldo ${saldo / 1e7} USDC · tope ${TOPE}`);
if (saldo < precio) {
  console.log("⛔ Saldo insuficiente. No se firmó nada.");
  process.exit(1);
}

// 4. Paga UNA vez. Si algo falla, no reintenta a ciegas: revisa el saldo.
try {
  const res = await fetchQuePaga(url.toString());
  const pago = http.getPaymentSettleResponse((h) => res.headers.get(h));
  console.log(`Respuesta ${res.status}:`, await res.json());
  console.log(`Pagó: https://stellar.expert/explorer/testnet/tx/${pago.transaction}`);
} catch (e) {
  if (String(e.message).includes("maxAmountPerPayment")) {
    console.log(`⛔ Rechazado: ${servicio.id} cuesta ${servicio.precio}, más que el tope (${TOPE}). No se firmó ni se envió ninguna transacción.`);
    process.exit(1);
  }
  const despues = await saldoUSDC();
  console.log(`❌ Falló el pago: ${e.message}`);
  console.log(
    despues < saldo
      ? "Ojo: el saldo sí bajó, el pago pudo liquidarse. Revisa la wallet antes de volver a intentar."
      : "El saldo no cambió: no se cobró nada. Puedes volver a intentar, que firmará una autorización nueva.",
  );
  process.exit(1);
}
