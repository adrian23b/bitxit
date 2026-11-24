import { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset, BASE_FEE } from "@stellar/stellar-sdk";
import { writeFileSync, existsSync } from "node:fs";

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const PRESUPUESTO = "0.10"; // lo único que el agente podrá gastar

if (existsSync(".env")) {
  console.log("Ya existe .env. Bórralo solo si quieres empezar de cero.");
  process.exit(0);
}

async function enviar(kp, operacion) {
  const cuenta = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(operacion).setTimeout(60).build();
  tx.sign(kp);
  return horizon.submitTransaction(tx);
}

async function crearCuenta(nombre) {
  const kp = Keypair.random();
  const r = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!r.ok) throw new Error(`Friendbot falló para ${nombre}: ${r.status}`);
  await enviar(kp, Operation.changeTrust({ asset: USDC })); // trustline: "acepto USDC"
  console.log(`✅ ${nombre}: ${kp.publicKey()}`);
  return kp;
}

const proveedor = await crearCuenta("Proveedor (cobra)");
const agente = await crearCuenta("Agente (paga)");

// Guardamos las llaves ya, antes del siguiente paso
writeFileSync(".env",
`MI_PUBLICA=${proveedor.publicKey()}\nMI_SECRETA=${proveedor.secret()}\nAGENTE_PUBLICA=${agente.publicKey()}\nAGENTE_SECRETA=${agente.secret()}\n`);
console.log("Llaves guardadas en .env (no se sube a GitHub).");

// El agente cambia XLM por su presupuesto de USDC en el exchange de Stellar
const rutas = await horizon.strictReceivePaths([Asset.native()], USDC, PRESUPUESTO).call();
if (!rutas.records.length) {
  console.log(`No hay ruta XLM→USDC ahora. Pide USDC en https://faucet.circle.com (Stellar testnet) para ${agente.publicKey()}`);
  process.exit(0);
}
const mejor = rutas.records[0];
const maxXlm = (Number(mejor.source_amount) * 1.05).toFixed(7);
const res = await enviar(agente, Operation.pathPaymentStrictReceive({
  sendAsset: Asset.native(), sendMax: maxXlm,
  destination: agente.publicKey(), destAsset: USDC, destAmount: PRESUPUESTO,
  path: mejor.path.map((p) => (p.asset_type === "native" ? Asset.native() : new Asset(p.asset_code, p.asset_issuer))),
}));
console.log(`✅ El agente tiene ${PRESUPUESTO} USDC de presupuesto: https://stellar.expert/explorer/testnet/tx/${res.hash}`);
console.log(`Mira la wallet del agente: https://stellar.expert/explorer/testnet/account/${agente.publicKey()}`);
