<div align="center">
  <!-- <a href="https://github.com/flolu/auth">
    <img width="100px" height="auto" src="./.github/thumbnail.png" />
  </a> -->
  <br>
  <h1>Node.js Kafka Example</h1>
  <p>Realtime Bitcoin & Ethereum Wallet Tracker with Clean Architecture</p>
  <img width="420px" src="./.github/preview.gif" />
</div>

# Features

- Interact with Kafka through Node.js
- Produce/consume events to/from topics
- Use Kafka as a queue and as a publish/subscribe system
- Kafka with Zookeeper and without Zookeeper using Redpanda
- Make use of Kafka's partitioning ability
- Real-time wallet balance tracking for BTC and ETH
- WebSocket server for real-time updates
- Clean Architecture implementation

# Tech Stack

- [Node.js](https://nodejs.org)
- [TypeScript](https://www.typescriptlang.org)
- [Docker](https://www.docker.com)
- [Kafka](https://kafka.apache.org) / [Redpanda](https://github.com/redpanda-data/redpanda)
- [WebSockets](https://github.com/websockets/ws)
- [Binance API](https://www.binance.com) (for price data)
- [BlockCypher API](https://www.blockcypher.com) (for wallet balances)

# Project Structure

This project follows **Clean Architecture** principles:

```
src/
├── domain/                    # Domain layer (business logic, no external dependencies)
│   └── events/               # Domain events and Kafka topics
│       └── events.ts
├── config/                   # Configuration adapters
│   ├── adapters/
│   │   └── envs.adapter.ts
│   └── types/
│       └── binance-connector.d.ts
├── presentation/             # Presentation layer (user interfaces)
│   ├── cli/                  # CLI application
│   │   └── cli.ts
│   ├── server.ts             # WebSocket server
│   ├── services/             # External service integrations
│   │   ├── price/
│   │   │   └── price.service.ts
│   │   └── wallet/
│   │       └── wallet.service.ts
│   ├── utils/                # Presentation utilities
│   │   └── utils.ts
│   └── wallet/
│       └── wallet-controller.ts
└── app.ts                    # Application entry point
```

# Usage

**Recommended OS**: Linux / Windows / macOS

**Requirements**: 
- Node.js (v18+)
- Docker & Docker Compose
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Docker services (Kafka/Redpanda):**
   ```bash
   docker-compose -f docker-compose.yaml up --build
   ```

3. **Configure environment variables (optional):**
   
   Create a `.env` file in the root directory:
   ```env
   KAFKA_BROKER=localhost:9092
   PORT=3000
   BLOCKCYPHER_TOKEN=your_token_here
   ```
   
   > **Note**: `BLOCKCYPHER_TOKEN` is optional but recommended. Get your token at [BlockCypher](https://accounts.blockcypher.com/tokens)

## Run

### Start the Server

In one terminal, start the WebSocket server:

```bash
npm run dev
# or
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Use the CLI Client

In another terminal, run the CLI with a wallet address:

```bash
npm run cli <WALLET_ADDRESS>
```

## CLI Examples

### Bitcoin (BTC) Addresses

```bash
# Genesis block address
npm run cli 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa

# Another valid BTC address
npm run cli 3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy

# Example from documentation
npm run cli 34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo
```

### Ethereum (ETH) Addresses

```bash
# Valid ETH address
npm run cli 0x742d35Cc6634C0532925a3b844Bc454e4438f44e

# Another valid ETH address
npm run cli 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Example from documentation
npm run cli 0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8
```

### CLI Controls

- **Enter**: Manually refresh wallet balance
- **Ctrl+C**: Exit the CLI application

## Monitoring

- **Redpanda Console**: http://localhost:8080 (if using Redpanda)
- View Kafka topics, messages, and consumer groups

## Notes

- The application fetches real-time prices from Binance API
- Wallet balances are fetched from BlockCypher API
- BlockCypher has rate limits on their free tier - if you hit the limit, you may need to wait or upgrade your API token
- The CLI automatically refreshes the balance every 60 seconds
- If a wallet address is not found, you'll see a clear error message

## Cleanup

Stop and remove Docker containers:

```bash
docker-compose -f docker-compose.yaml rm -s -f -v
```

# Codebase Overview

## Key Files

- **`src/app.ts`** - Application entry point, initializes the server
- **`src/presentation/server.ts`** - WebSocket server that communicates with CLI clients and Kafka
- **`src/presentation/cli/cli.ts`** - CLI application to read wallet data in real-time
- **`src/presentation/services/wallet/wallet.service.ts`** - Service that crawls wallet balance from BlockCypher API
- **`src/presentation/services/price/price.service.ts`** - Service that writes real-time price events to Kafka from Binance
- **`src/presentation/wallet/wallet-controller.ts`** - Controller that manages WebSocket connections and Kafka consumers
- **`src/domain/events/events.ts`** - Domain events and Kafka topic definitions
- **`src/config/adapters/envs.adapter.ts`** - Environment configuration adapter

## Architecture Layers

- **Domain**: Contains business logic and domain events (no external dependencies)
- **Presentation**: Contains user interfaces (CLI, WebSocket server, controllers)
- **Config**: Contains configuration adapters and type definitions

## How It Works

1. The **Price Service** connects to Binance WebSocket and publishes price updates to Kafka
2. The **Wallet Service** consumes balance requests from Kafka and fetches data from BlockCypher API
3. The **WebSocket Server** manages client connections and coordinates between services
4. The **CLI Client** connects via WebSocket and receives real-time updates about wallet balances and prices
