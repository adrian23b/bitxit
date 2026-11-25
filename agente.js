import { x402Client, x402HTTPClient, wrapFetchWithPayment } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const BASE = "http://localhost:3001";
const NETWORK = "stellar:testnet";
const ID = process.argv[2] || "dato"; // qué servicio quiere comprar

// El agente firma con SU wallet, nunca con la del proveedor
const signer = createEd25519Signer(process.env.AGENTE_SECRETA, NETWORK);
const client = x402Client.fromConfig({
  schemes: [{ network: "stellar:*", client: new ExactStellarScheme(signer, { url: "https://soroban-testnet.stellar.org" }) }],
});
const fetchQuePaga = wrapFetchWithPayment(fetch, client);

// 1. Lee el catálogo (gratis) y busca el servicio
const catalogo = await (await fetch(`${BASE}/catalogo`)).json();
const servicio = catalogo.servicios.find((s) => s.id === ID);
if (!servicio) {
  console.log(`❌ No existe el servicio "${ID}". Hay: ${catalogo.servicios.map((s) => s.id).join(", ")}`);
  process.exit(1);
}
const url = new URL(servicio.ruta, BASE);
if (ID === "resumen") url.searchParams.set("texto", "bitxit es un mercado donde agentes se compran servicios con micropagos");

console.log(`🤖 Agente ${signer.address}`);
console.log(`Quiere comprar: ${servicio.id} (${servicio.precio})`);

// 2. Pide el servicio: si responde 402, fetchQuePaga paga y vuelve a pedir
const res = await fetchQuePaga(url.toString());
const pago = new x402HTTPClient(client).getPaymentSettleResponse((h) => res.headers.get(h));
console.log(`Respuesta ${res.status}:`, await res.json());
console.log(`Pagó: https://stellar.expert/explorer/testnet/tx/${pago.transaction}`);
