import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const PORT = 3001;
const NETWORK = "stellar:testnet";
const FACILITATOR_URL = "https://www.x402.org/facilitator";
const PAY_TO = process.env.MI_PUBLICA; // la wallet del proveedor recibe los pagos

const CATALOGO = [
  { id: "dato", ruta: "/servicio/dato", precio: "$0.01", descripcion: "Un dato curioso sobre pagos en internet" },
  { id: "resumen", ruta: "/servicio/resumen", precio: "$0.02", descripcion: "Resume un texto (parámetro ?texto=)" },
  { id: "auditoria", ruta: "/servicio/auditoria", precio: "$0.05", descripcion: "Reporte premium de auditoría (demo)" },
];

const SERVICIOS = {
  dato: () => ({ dato: "El código HTTP 402 significa Payment Required y existe desde los años noventa" }),
  resumen: (req) => {
    const texto = String(req.query.texto || "");
    return { resumen: texto.split(/\s+/).filter(Boolean).slice(0, 15).join(" ") };
  },
  auditoria: () => ({ reporte: "Auditoría completa: 0 hallazgos críticos, 2 recomendaciones (demo)" }),
};

const app = express();

// Gratis: el agente ve qué se vende y a qué precio
app.get("/catalogo", (_, res) => res.json({ red: NETWORK, servicios: CATALOGO }));

// x402: una regla de cobro por cada servicio del catálogo
const reglas = Object.fromEntries(
  CATALOGO.map((s) => [
    `GET ${s.ruta}`,
    { accepts: { scheme: "exact", price: s.precio, network: NETWORK, payTo: PAY_TO } },
  ]),
);

app.use(
  paymentMiddlewareFromConfig(
    reglas,
    new HTTPFacilitatorClient({ url: FACILITATOR_URL }),
    [{ network: NETWORK, server: new ExactStellarScheme() }],
  ),
);

// Esto solo se entrega cuando el pago ya se verificó y se liquidó
for (const s of CATALOGO) {
  app.get(s.ruta, (req, res) => res.json({ servicio: s.id, pagado: true, ...SERVICIOS[s.id](req) }));
}

app.listen(PORT, () => console.log(`bitxit proveedor (cobra con x402) en http://localhost:${PORT}/catalogo`));
