# Guía Completa del Proyecto - Kafka Wallet Tracker

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estructura de Carpetas](#estructura-de-carpetas)
5. [Análisis Detallado por Capa](#análisis-detallado-por-capa)
6. [Flujo Completo de Datos](#flujo-completo-de-datos)
7. [Ejemplos Prácticos](#ejemplos-prácticos)
8. [Casos de Uso](#casos-de-uso)

---

## 🎯 Visión General

Este proyecto es un **sistema de seguimiento en tiempo real de wallets de criptomonedas** (Bitcoin y Ethereum) que utiliza:

- **Kafka/Redpanda** como sistema de mensajería y cola de eventos
- **WebSockets** para comunicación en tiempo real entre cliente y servidor
- **APIs externas** (Binance y BlockCypher) para obtener datos
- **Clean Architecture** para mantener el código organizado y mantenible

### ¿Qué hace el sistema?

1. **Monitorea precios** de BTC y ETH desde Binance en tiempo real
2. **Consulta balances** de wallets desde BlockCypher API
3. **Notifica cambios** a clientes conectados vía WebSocket
4. **Maneja errores** de forma elegante (rate limits, direcciones no encontradas)

---

## 🏗️ Arquitectura del Proyecto

### Clean Architecture

El proyecto sigue los principios de **Clean Architecture**, dividiéndose en 3 capas principales:

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │  ← Interfaces de usuario
│  (CLI, WebSocket Server, Controllers)   │
└─────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────┐
│         DOMAIN LAYER                     │  ← Lógica de negocio
│  (Events, Enums, Domain Rules)           │
└─────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────┐
│      INFRASTRUCTURE/CONFIG LAYER        │  ← Implementaciones
│  (Services, Config, External APIs)      │
└─────────────────────────────────────────┘
```

### Principios Aplicados

1. **Separación de Responsabilidades**: Cada capa tiene un propósito específico
2. **Inversión de Dependencias**: Las capas superiores dependen de abstracciones
3. **Independencia de Frameworks**: El dominio no depende de librerías externas
4. **Testabilidad**: Cada componente puede probarse de forma aislada

---

## 🛠️ Stack Tecnológico

### ¿Por qué estas tecnologías?

| Tecnología | Propósito | ¿Por qué? |
|------------|-----------|-----------|
| **Node.js + TypeScript** | Runtime y tipado | JavaScript es ideal para I/O asíncrono, TypeScript añade seguridad de tipos |
| **Kafka/Redpanda** | Sistema de mensajería | Permite procesamiento asíncrono, escalabilidad y desacoplamiento |
| **WebSockets (ws)** | Comunicación en tiempo real | Permite push de datos sin polling constante |
| **Axios** | Cliente HTTP | Manejo robusto de peticiones HTTP con interceptores |
| **Binance Connector** | API de precios | WebSocket nativo para precios en tiempo real |
| **BlockCypher API** | Datos de blockchain | API confiable para balances de wallets |
| **Docker Compose** | Orquestación | Facilita el despliegue de Kafka/Redpanda |

---

## 📁 Estructura de Carpetas

```
src/
├── domain/                          # CAPA DE DOMINIO
│   └── events/
│       └── events.ts               # Eventos y constantes del dominio
│
├── config/                          # CONFIGURACIÓN
│   ├── adapters/
│   │   └── envs.adapter.ts         # Adaptador de variables de entorno
│   └── types/
│       └── binance-connector.d.ts   # Tipos TypeScript para Binance
│
├── presentation/                    # CAPA DE PRESENTACIÓN
│   ├── cli/
│   │   └── cli.ts                  # Cliente de línea de comandos
│   ├── server.ts                   # Servidor WebSocket
│   ├── wallet/
│   │   └── wallet-controller.ts    # Controlador de wallets
│   ├── services/
│   │   ├── price/
│   │   │   └── price.service.ts    # Servicio de precios (Binance)
│   │   └── wallet/
│   │       └── wallet.service.ts   # Servicio de wallets (BlockCypher)
│   └── utils/
│       └── utils.ts                # Utilidades de presentación
│
└── app.ts                          # Punto de entrada
```

---

## 🔍 Análisis Detallado por Capa

### 1. DOMAIN LAYER - `src/domain/events/events.ts`

**Propósito**: Define las constantes y eventos del dominio sin dependencias externas.

```typescript
export enum KafkaTopics {
  CurrencyPrice = 'currency-price',        // Precios de criptomonedas
  WalletBalance = 'wallet-balance',        // Balances de wallets
  TaskToReadBalance = 'task-to-read-balance',  // Tareas para leer balances
  WalletBalanceError = 'wallet-balance-error'  // Errores de wallets
}

export enum WebSocketEvents {
  SetupWallet = 'setup-wallet',            // Configurar wallet
  ReadBalance = 'read-balance',            // Leer balance
  PriceUpdated = 'price-updated',          // Precio actualizado
  BalanceUpdated = 'balance-updated',      // Balance actualizado
  Error = 'error'                          // Error ocurrido
}
```

**¿Por qué aquí?**
- No tiene dependencias externas
- Define el "vocabulario" del dominio
- Puede ser usado por cualquier capa
- Fácil de testear

---

### 2. CONFIG LAYER - `src/config/adapters/envs.adapter.ts`

**Propósito**: Centraliza y valida todas las variables de entorno.

```typescript
export const envs = {
    KAFKA_BROKER: get('KAFKA_BROKER').default('localhost:9092').asString(),
    PORT: get('PORT').default(3000).asPortNumber(),
    WEBSOCKET_URL: get('WEBSOCKET_URL').default('ws://localhost:3000').asString(),
    BLOCKCYPHER_API_URL: get('BLOCKCYPHER_API_URL').default('https://api.blockcypher.com/v1').asString(),
    BLOCKCYPHER_TOKEN: get('BLOCKCYPHER_TOKEN').asString(),
    KAFKA_CONSUMER_GROUP_ID: get('KAFKA_CONSUMER_GROUP_ID').default('balance-crawler').asString()
};
```

**Funciones**:
- **Validación**: `env-var` valida tipos y valores
- **Defaults**: Proporciona valores por defecto sensatos
- **Centralización**: Un solo lugar para toda la configuración

**¿Por qué `env-var`?**
- Valida tipos automáticamente
- Proporciona mensajes de error claros
- Previene errores en tiempo de ejecución

---

### 3. PRESENTATION LAYER

#### 3.1 Punto de Entrada - `src/app.ts`

**Propósito**: Inicializa y arranca toda la aplicación.

```typescript
(async () => {
    console.table(envs);  // Muestra configuración
    
    const server = new Server({
        kafkaBroker: envs.KAFKA_BROKER,
        port: envs.PORT,
        blockcypherApiUrl: envs.BLOCKCYPHER_API_URL,
        blockcypherToken: envs.BLOCKCYPHER_TOKEN,
        consumerGroupId: envs.KAFKA_CONSUMER_GROUP_ID
    });

    server.init()  // Inicia el servidor
})()
```

**Flujo**:
1. Carga variables de entorno
2. Crea instancia del servidor con configuración
3. Inicia el servidor

---

#### 3.2 Servidor WebSocket - `src/presentation/server.ts`

**Propósito**: Gestiona conexiones WebSocket y coordina servicios.

**Componentes principales**:

```typescript
export class Server {
  private readonly kafka: Kafka              // Cliente Kafka
  private readonly wss: WebSocketServer      // Servidor WebSocket
  private walletController: WalletController // Controlador de wallets
  private priceService: PriceService         // Servicio de precios
}
```

**Métodos clave**:

1. **`init()`**: Inicializa todos los servicios
   ```typescript
   await this.walletController.initialize()  // Inicia controlador
   await this.priceService.start()          // Inicia servicio de precios
   this.setupWebSocketServer()              // Configura WebSocket
   ```

2. **`setupWebSocketServer()`**: Maneja conexiones WebSocket
   - Genera UUID único para cada cliente
   - Registra cliente en el controlador
   - Maneja mensajes entrantes
   - Limpia al desconectar

3. **`setupGracefulShutdown()`**: Cierre ordenado
   - Escucha señal SIGTERM
   - Cierra conexiones limpiamente
   - Evita pérdida de datos

**¿Por qué WebSocket?**
- **Push en tiempo real**: El servidor puede enviar datos sin que el cliente pregunte
- **Baja latencia**: Conexión persistente, sin overhead de HTTP
- **Bidireccional**: Cliente y servidor pueden enviar mensajes

---

#### 3.3 Controlador de Wallets - `src/presentation/wallet/wallet-controller.ts`

**Propósito**: Coordina entre WebSocket, Kafka y servicios.

**Responsabilidades**:

1. **Gestión de Clientes**:
   ```typescript
   private readonly clients = new Map<string, WebSocket>()
   private readonly clientWallets = new Map<string, { address: string; currency: string }>()
   ```
   - Mapea socketId → WebSocket
   - Mapea socketId → wallet configurada

2. **Consumidores Kafka**:
   - `priceConsumer`: Escucha actualizaciones de precios
   - `balanceConsumer`: Escucha actualizaciones de balances
   - `errorConsumer`: Escucha errores

3. **Manejo de Mensajes**:
   ```typescript
   case WebSocketEvents.SetupWallet:
     // Configura wallet para un cliente
     await this.handleSetupWallet(socketId, data)
   
   case WebSocketEvents.ReadBalance:
     // Solicita lectura de balance
     await this.handleReadBalance(socketId)
   ```

4. **Notificaciones**:
   - `notifyClientsAboutPriceUpdate()`: Notifica a clientes cuando cambia el precio
   - `notifyClientsAboutBalanceUpdate()`: Notifica cuando cambia el balance
   - `notifyClientsAboutError()`: Notifica errores

**Flujo de `handleSetupWallet`**:
```typescript
1. Determina currency (BTC o ETH) desde la dirección
2. Guarda la wallet del cliente
3. Si hay precio en cache → lo envía inmediatamente
4. Si hay balance en cache → lo envía inmediatamente
5. Si no hay balance → solicita lectura (envía a Kafka)
```

---

#### 3.4 Servicio de Precios - `src/presentation/services/price/price.service.ts`

**Propósito**: Obtiene precios en tiempo real de Binance y los publica en Kafka.

**Cómo funciona**:

```typescript
1. Conecta a Binance WebSocket
   this.client.combinedStreams(['btcusdt@ticker', 'ethusdt@ticker'])

2. Recibe mensajes en tiempo real
   message: async (json: string) => {
     const { stream, data } = JSON.parse(json)
     const currency = stream.split('usdt@ticker')[0]  // 'btc' o 'eth'
     const price = Number(data.c)  // Precio de cierre
   }

3. Publica en Kafka
   await this.producer.send({
     topic: KafkaTopics.CurrencyPrice,
     messages: [{ key: currency, value: payload }]
   })
```

**¿Por qué Binance?**
- WebSocket nativo para datos en tiempo real
- Alta frecuencia de actualizaciones
- API gratuita y confiable

**¿Por qué Kafka para precios?**
- **Desacoplamiento**: El servicio de precios no conoce a los clientes
- **Escalabilidad**: Múltiples consumidores pueden leer precios
- **Persistencia**: Los precios se pueden almacenar para análisis histórico

---

#### 3.5 Servicio de Wallets - `src/presentation/services/wallet/wallet.service.ts`

**Propósito**: Consume tareas de lectura de balances y consulta BlockCypher API.

**Flujo completo**:

```typescript
1. Consume mensajes de Kafka (topic: TaskToReadBalance)
   await this.taskConsumer.subscribe({ 
     topic: KafkaTopics.TaskToReadBalance 
   })

2. Para cada mensaje:
   a. Parsea address y currency
   b. Llama a getWalletBalance(currency, address)
   c. Publica resultado en Kafka (topic: WalletBalance)
   d. Si hay error → publica en Kafka (topic: WalletBalanceError)

3. getWalletBalance():
   - Construye URL: `${apiUrl}/${currency}/main/addrs/${address}/balance`
   - Hace petición HTTP con axios
   - Convierte balance (wei/satoshi → unidades normales)
   - Maneja errores (404, rate limits)
```

**Conversión de unidades**:
```typescript
// Bitcoin: satoshis → BTC
if (currency === 'btc') return data.balance / 100000000

// Ethereum: wei → ETH
return data.balance / 1000000000000000000
```

**Manejo de errores**:
- **404**: Wallet no encontrada
- **429**: Rate limit alcanzado
- **Otros**: Errores genéricos

**¿Por qué BlockCypher?**
- API confiable para datos de blockchain
- Soporta múltiples criptomonedas
- Documentación clara

**¿Por qué Kafka para tareas?**
- **Cola de trabajo**: Permite procesar balances de forma asíncrona
- **Retry automático**: Si falla, el mensaje puede reintentarse
- **Escalabilidad**: Múltiples workers pueden procesar tareas

---

#### 3.6 Cliente CLI - `src/presentation/cli/cli.ts`

**Propósito**: Interfaz de línea de comandos para monitorear wallets.

**Funcionalidades**:

1. **Conexión WebSocket**:
   ```typescript
   const ws = new WebSocket(envs.WEBSOCKET_URL)
   ```

2. **Al conectar**:
   - Envía `SetupWallet` con la dirección
   - Configura listener de teclado
   - Inicia loop de actualización cada 60 segundos

3. **Manejo de eventos**:
   ```typescript
   case WebSocketEvents.BalanceUpdated:
     balance = data.balance
     printBalance(currency, price, balance)
   
   case WebSocketEvents.PriceUpdated:
     price = data.price
     printBalance(currency, price, balance)
   
   case WebSocketEvents.Error:
     // Muestra error con contexto
   ```

4. **Controles**:
   - **Enter**: Solicita actualización manual de balance
   - **Ctrl+C**: Cierra la aplicación

**¿Por qué CLI?**
- Interfaz simple y directa
- Fácil de usar desde terminal
- No requiere navegador

---

#### 3.7 Utilidades - `src/presentation/utils/utils.ts`

**Funciones auxiliares**:

1. **`setupKeyListener()`**: Captura teclas del teclado
   - Usa `readline` de Node.js
   - Modo raw para capturar teclas sin Enter

2. **`sendSocketMessage()`**: Envía mensajes WebSocket
   - Valida que el socket esté abierto
   - Serializa a JSON

3. **`loadWalletBalanceLoop()`**: Loop de actualización
   - Recursivo con `setTimeout`
   - Se detiene si el socket se cierra

4. **`formatUSD()`**: Formatea números como moneda USD
   - Usa `Intl.NumberFormat`

5. **`printBalance()`**: Imprime balance en consola
   - Actualiza en el mismo lugar (mueve cursor)
   - Muestra: Wallet, Price, Balance, Value

6. **`getCurrencyFromAddress()`**: Determina currency
   - `0x...` → ETH
   - Otro → BTC

---

## 🔄 Flujo Completo de Datos

### Escenario 1: Usuario inicia el CLI

```
1. Usuario ejecuta: npm run cli 0x742d35Cc6634C0532925a3b844Bc454e4438f44e

2. CLI se conecta a WebSocket (ws://localhost:3000)
   └─> Server genera socketId único (UUID)

3. CLI envía: { type: 'setup-wallet', data: '0x742d...' }
   └─> Server → WalletController.handleMessage()

4. WalletController:
   a. Determina currency: 'eth' (empieza con 0x)
   b. Guarda wallet del cliente
   c. Busca precio en cache → Si existe, lo envía
   d. Busca balance en cache → Si no existe, solicita lectura

5. WalletController envía tarea a Kafka:
   Topic: 'task-to-read-balance'
   Message: { address: '0x742d...', currency: 'eth' }

6. WalletService consume la tarea:
   a. Llama a BlockCypher API
   b. Obtiene balance
   c. Publica resultado en Kafka:
      Topic: 'wallet-balance'
      Message: { balance: 1.5 }

7. WalletController consume el resultado:
   a. Actualiza cache de balances
   b. Notifica al cliente vía WebSocket:
      { type: 'balance-updated', data: { balance: 1.5 } }

8. CLI recibe el mensaje:
   a. Actualiza variable balance
   b. Imprime en consola
```

### Escenario 2: Actualización de precio

```
1. PriceService está conectado a Binance WebSocket

2. Binance envía actualización de precio:
   { stream: 'btcusdt@ticker', data: { c: '45000' } }

3. PriceService:
   a. Extrae currency: 'btc'
   b. Extrae price: 45000
   c. Publica en Kafka:
      Topic: 'currency-price'
      Message: { price: 45000 }
      Key: 'btc'

4. WalletController consume el precio:
   a. Actualiza cache: prices['btc'] = 45000
   b. Busca clientes con currency 'btc'
   c. Notifica a cada cliente:
      { type: 'price-updated', data: { price: 45000 } }

5. CLI recibe el mensaje:
   a. Actualiza variable price
   b. Re-imprime balance con nuevo precio
```

### Escenario 3: Error (Wallet no encontrada)

```
1. WalletService intenta obtener balance de dirección inválida

2. BlockCypher API responde: 404 Not Found

3. WalletService:
   a. Detecta error 404
   b. Extrae mensaje de error
   c. Publica en Kafka:
      Topic: 'wallet-balance-error'
      Message: { 
        address: '0x123...',
        error: 'Wallet address not found',
        isNotFound: true,
        isRateLimit: false
      }

4. WalletController consume el error:
   a. Busca clientes con esa dirección
   b. Notifica vía WebSocket:
      { 
        type: 'error',
        data: { 
          error: 'Wallet address not found',
          isNotFound: true,
          address: '0x123...'
        }
      }

5. CLI recibe el error:
   a. Muestra mensaje claro
   b. Sugiere verificar la dirección
```

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Monitorear wallet de Bitcoin

```bash
# Terminal 1: Iniciar servidor
npm start

# Terminal 2: Monitorear wallet
npm run cli 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
```

**Lo que sucede**:
1. CLI se conecta al servidor
2. Servidor solicita balance de la wallet
3. BlockCypher consulta la blockchain
4. Balance se muestra en tiempo real
5. Precio de BTC se actualiza cada vez que Binance lo actualiza

**Salida esperada**:
```
Wallet:  BTC
Price:   $45,000.00
Balance: 0.00123456
Value:   $55.56
```

### Ejemplo 2: Monitorear wallet de Ethereum

```bash
npm run cli 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

**Diferencias**:
- Currency detectada: ETH (empieza con 0x)
- Conversión: wei → ETH (división por 10^18)
- Precio: ETH/USDT desde Binance

### Ejemplo 3: Actualización manual

```
1. CLI está mostrando balance
2. Usuario presiona Enter
3. CLI envía: { type: 'read-balance' }
4. Servidor solicita nuevo balance
5. Balance se actualiza en pantalla
```

---

## 🎯 Casos de Uso

### Caso 1: Monitoreo continuo
**Escenario**: Quieres monitorear tu wallet las 24 horas

**Solución**: 
- El CLI se actualiza automáticamente cada 60 segundos
- Los precios se actualizan en tiempo real desde Binance
- No necesitas hacer nada

### Caso 2: Verificación rápida
**Escenario**: Quieres verificar el balance de una wallet una vez

**Solución**:
- Ejecutas el CLI con la dirección
- Esperas a que cargue
- Presionas Ctrl+C para salir

### Caso 3: Múltiples wallets
**Escenario**: Quieres monitorear varias wallets

**Solución**:
- Abres múltiples terminales
- Cada una ejecuta el CLI con una dirección diferente
- Todas se conectan al mismo servidor
- El servidor gestiona múltiples clientes simultáneamente

---

## 🔧 Conceptos Clave

### Kafka Topics

1. **`currency-price`**: Precios de criptomonedas
   - Producer: PriceService
   - Consumer: WalletController
   - Formato: `{ price: number }`
   - Key: currency ('btc' o 'eth')

2. **`wallet-balance`**: Balances de wallets
   - Producer: WalletService
   - Consumer: WalletController
   - Formato: `{ balance: number }`
   - Key: wallet address

3. **`task-to-read-balance`**: Cola de tareas
   - Producer: WalletController
   - Consumer: WalletService
   - Formato: `{ address: string, currency: string }`
   - Key: wallet address

4. **`wallet-balance-error`**: Errores
   - Producer: WalletService
   - Consumer: WalletController
   - Formato: `{ address, error, isNotFound, isRateLimit }`
   - Key: wallet address

### Consumer Groups

- **`balance-crawler`**: Grupo para WalletService
  - Permite escalar: múltiples instancias procesan tareas
  - Cada mensaje se procesa una sola vez

- **`server-price-{timestamp}`**: Grupo único para precios
  - Cada servidor tiene su propio grupo
  - Todos reciben todos los mensajes (broadcast)

### WebSocket Events

- **`setup-wallet`**: Cliente → Servidor
  - Configura wallet a monitorear

- **`read-balance`**: Cliente → Servidor
  - Solicita actualización de balance

- **`price-updated`**: Servidor → Cliente
  - Notifica cambio de precio

- **`balance-updated`**: Servidor → Cliente
  - Notifica cambio de balance

- **`error`**: Servidor → Cliente
  - Notifica error

---

## 🚀 Ventajas de esta Arquitectura

1. **Escalabilidad**:
   - Múltiples instancias de WalletService pueden procesar tareas
   - Kafka distribuye la carga automáticamente

2. **Desacoplamiento**:
   - PriceService no conoce a los clientes
   - WalletService no conoce a los clientes
   - Todo se comunica vía Kafka

3. **Resiliencia**:
   - Si un servicio falla, los mensajes quedan en Kafka
   - Pueden reprocesarse cuando el servicio se recupere

4. **Mantenibilidad**:
   - Cada componente tiene una responsabilidad clara
   - Fácil de testear y modificar

5. **Extensibilidad**:
   - Fácil agregar nuevos tipos de eventos
   - Fácil agregar nuevos consumidores
   - Fácil agregar nuevas interfaces (web, mobile)

---


