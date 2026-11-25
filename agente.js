import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const BASE = "http://localhost:3001";
const NETWORK = "stellar:testnet";
const ID = process.argv[2] || "dato";
const TOPE = process.env.TOPE || "$0.02"; // lo máximo que el agente paga por UNA compra

const signer = createEd25519Signer(process.env.AGENTE_SECRETA, NETWORK);
const client = x402Client.fromConfig({
  schemes: [{ network: "stellar:*", client: new ExactStellarScheme(signer, { url: "https://soroban-testnet.stellar.org" }) }],
  // Tope: si el proveedor cobra más, x402 lo rechaza ANTES de firmar
  spendControls: { maxAmountPerPayment: TOPE },
});
const fetchQuePaga = wrapFetchWithPayment(fetch, client);

const catalogo = await (await fetch(`${BASE}/catalogo`)).json();
const servicio = catalogo.servicios.find((s) => s.id === ID);
if (!servicio) {
  console.log(`❌ No existe el servicio "${ID}". Hay: ${catalogo.servicios.map((s) => s.id).join(", ")}`);
  process.exit(1);
}
const url = new URL(servicio.ruta, BASE);
if (ID === "resumen") url.searchParams.set("texto", "bitxit es un mercado donde agentes se compran servicios con micropagos");

console.log(`🤖 Agente ${signer.address} (tope ${TOPE} por compra)`);
console.log(`Quiere comprar: ${servicio.id} (${servicio.precio})`);

try {
  const res = await fetchQuePaga(url.toString());
  const pago = new x402HTTPClient(client).getPaymentSettleResponse((h) => res.headers.get(h));
  console.log(`Respuesta ${res.status}:`, await res.json());
  console.log(`Pagó: https://stellar.expert/explorer/testnet/tx/${pago.transaction}`);
} catch (e) {
  if (String(e.message).includes("maxAmountPerPayment")) {
    console.log(`⛔ Rechazado: ${servicio.id} cuesta ${servicio.precio}, más que el tope (${TOPE}). No se firmó ni se envió ninguna transacción.`);
    process.exit(1);
  }
  throw e;
}
