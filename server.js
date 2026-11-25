import express from "express";

const PORT = 3001;

// Catálogo: lo que bitxit vende. El agente lo lee para decidir qué comprar.
const CATALOGO = [
  { id: "dato", ruta: "/servicio/dato", precio: "$0.01", descripcion: "Un dato curioso sobre pagos en internet" },
  { id: "resumen", ruta: "/servicio/resumen", precio: "$0.02", descripcion: "Resume un texto (parámetro ?texto=)" },
  { id: "auditoria", ruta: "/servicio/auditoria", precio: "$0.05", descripcion: "Reporte premium de auditoría (demo)" },
];

// Lo que hace cada servicio
const SERVICIOS = {
  dato: () => ({ dato: "El código HTTP 402 significa Payment Required y existe desde los años noventa" }),
  resumen: (req) => {
    const texto = String(req.query.texto || "");
    return { resumen: texto.split(/\s+/).filter(Boolean).slice(0, 15).join(" ") };
  },
  auditoria: () => ({ reporte: "Auditoría completa: 0 hallazgos críticos, 2 recomendaciones (demo)" }),
};

const app = express();

// Gratis: cualquier agente puede ver qué se vende y a qué precio
app.get("/catalogo", (_, res) => res.json({ red: "stellar:testnet", servicios: CATALOGO }));

// Servicios (por ahora gratis)
for (const s of CATALOGO) {
  app.get(s.ruta, (req, res) => res.json({ servicio: s.id, gratis: true, ...SERVICIOS[s.id](req) }));
}

app.listen(PORT, () => console.log(`bitxit proveedor listo en http://localhost:${PORT}/catalogo`));
