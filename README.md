# bitxit

Mercado de servicios digitales **agente a agente**. Un proveedor vende servicios por HTTP y cobra con **x402** en USDC sobre **Stellar testnet**. Un agente con wallet propia los compra solo, con tope de gasto y sin pagar a ciegas.

Track: **Agente que paga (x402)** · Código 402, BAF México × Programa de Embajadores de Stellar.

> Todo es en Stellar testnet: dinero de prueba, sin valor real.

## Problema

Los agentes de IA ya pueden llamar APIs, pero pagarlas sigue siendo humano: tarjetas, suscripciones y llaves de API. Dar a un agente una tarjeta es riesgoso, porque no tiene límites. bitxit muestra otra forma: el agente paga cada llamada con micropagos de centavos desde una wallet pequeña, con reglas claras de cuánto puede gastar.

## Cómo funciona

1. El agente lee el catálogo gratis (`/catalogo`).
2. Pide un servicio y el proveedor responde **402** con el precio.
3. El agente revisa su tope y su saldo. Si todo está bien, firma el pago con su wallet y vuelve a pedir.
4. El facilitador de x402 verifica y liquida el pago en Stellar.
5. El proveedor responde **200** con el servicio.

## Servicios del catálogo

| Servicio | Ruta | Precio (USDC) |
|---|---|---|
| dato | /servicio/dato | 0.01 |
| resumen | /servicio/resumen | 0.02 |
| auditoria | /servicio/auditoria | 0.05 |

## Cómo cuida el dinero el agente

- **Wallet propia.** El agente firma con su llave, nunca con la del proveedor. Su presupuesto es de 0.10 USDC, así que lo máximo que puede perder es eso.
- **Tope por compra** (`spendControls.maxAmountPerPayment`, por defecto $0.02). Si un servicio cuesta más, como `auditoria` ($0.05), se rechaza antes de firmar y no se crea ninguna transacción.
- **Saldo insuficiente.** Antes de firmar compara su saldo con el precio y se detiene si no le alcanza.
- **Reintentos sin pagar a ciegas.** Si el proveedor no responde, reintenta hasta 3 veces con espera creciente, pero solo peticiones que no pagan. El pago se intenta una sola vez. Si algo falla después, revisa si su saldo bajó antes de volver a intentar.
- **Autorización expirada.** Cada intento nuevo firma una autorización nueva.
- **Sin secretos en el repo.** `.env` está en `.gitignore`. La llave del agente nunca llega al navegador.
- **Panel seguro.** El panel solo acepta ids que existan en el catálogo, ejecuta una compra a la vez y pasa el id sin shell.

## Cómo correrlo

Necesitas Node 22.12 o más (probado con 24). Todo se hace en una terminal.

    npm install
    npm run cuentas      # crea la wallet del proveedor y la del agente (con 0.10 USDC)
    npm run api          # proveedor en el puerto 3001
    npm run web          # panel del agente en el puerto 3002
    npm run agente -- dato          # compra desde la terminal
    npm run agente -- auditoria     # rechazada por el tope
    TOPE='$0.05' npm run agente -- auditoria    # con otro tope sí paga

Abre `http://localhost:3002` para ver el panel: catálogo, saldo, tope e historial con el link de cada pago.

Notas:
- `api` y `web` leen `.env` solo al arrancar: si cambias `.env`, reinícialos.
- Para darle presupuesto nuevo al agente sin tocar al proveedor: `npm run nuevo-agente`.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `crear-cuentas.js` | Crea las wallets de proveedor y agente en testnet |
| `server.js` | Proveedor: catálogo gratis y servicios que cobran con x402 |
| `agente.js` | Agente comprador: tope, saldo, reintentos |
| `web.js` + `public/index.html` | Panel web del agente |
| `nuevo-agente.js` | Renueva la wallet y el presupuesto del agente |
| `docs/DEMO.md` | Guion de la demo en video |
| `docs/PITCH.md` | Pitch de 3 minutos |

## Hash de prueba (compra reciente)

- Agente: `GDINAIEJ65NOY4LB2PPUR5VITQTHGACTHR2WECBEC3PM5VND2EZR7OGO`
- Proveedor: `GCRR34IALBYMFRUDHA6HEREPJXABNMU3TKTMS65HMM47F5XCDEQWNL33`
- Pago de 0.01 USDC por el servicio "dato": `d5271fe7361cff79eff9ec40c45034062bcac44eda18b04eaf1f2e421e77c248`
- Verlo: https://stellar.expert/explorer/testnet/tx/d5271fe7361cff79eff9ec40c45034062bcac44eda18b04eaf1f2e421e77c248

## Limitaciones y siguiente paso

- Hoy una persona elige el servicio desde el panel o la terminal. Lo siguiente es que el agente elija solo según su presupuesto y su necesidad.
- Solo hay un proveedor local. Lo siguiente es varios proveedores en un directorio.
- El tope vive en el código del agente. Lo siguiente es llevarlo a la cuenta con smart accounts de OpenZeppelin, para que sea una regla del contrato.
- Todo corre en testnet. Pasar a mainnet requiere USDC real y revisión de seguridad.

## Historial de pagos de prueba
## Mi agente compra en bitxit
- Compra del servicio "dato" (0.01 USDC): 9b04e464633895979ab0ca355225d0a5d7549129c860442e1c057e6d7a14424d
- Verlo: https://stellar.expert/explorer/testnet/tx/9b04e464633895979ab0ca355225d0a5d7549129c860442e1c057e6d7a14424d

## Errores y reintentos
- Si el proveedor no responde, el agente reintenta hasta 3 veces sin pagar.
- Revisa su saldo antes de firmar y nunca repite un pago a ciegas.
- Compra con manejo de errores: 31f34ee58bb764c284529672842a4f596f9128dec707a9eb492f7492496f120e
- Verlo: https://stellar.expert/explorer/testnet/tx/31f34ee58bb764c284529672842a4f596f9128dec707a9eb492f7492496f120e
