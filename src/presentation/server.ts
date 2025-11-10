// server.ts
import { WebSocketServer } from 'ws'
import { Kafka, logLevel } from 'kafkajs'
import { v4 as uuidv4 } from 'uuid'
import { KafkaTopics } from '../domain/events/events';
import { WalletController } from './wallet/wallet-controller'
import { PriceService } from './services/price/price.service'

export class Server {
  private readonly kafka: Kafka
  private readonly wss: WebSocketServer
  private walletController: WalletController
  private priceService: PriceService

  constructor(private readonly kafkaBroker: string, private readonly port: number = 3000) {
    if (!kafkaBroker) {
      throw new Error('KAFKA_BROKER environment variable is required')
    }

    this.kafka = new Kafka({ brokers: [kafkaBroker], logLevel: logLevel.ERROR })
    this.wss = new WebSocketServer({ port: this.port })
    this.walletController = new WalletController(this.kafka)
    this.priceService = new PriceService(kafkaBroker)
  }

  public async init(): Promise<void> {
    await this.walletController.initialize()
    await this.priceService.start()
    this.setupWebSocketServer()
    this.setupGracefulShutdown()
    console.log(`Server started on port ${this.port}`)
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws) => {
      const socketId = uuidv4()
      this.walletController.addClient(socketId, ws)

      ws.on('close', () => {
        this.walletController.removeClient(socketId)
      })

      ws.on('message', (payload: string) => {
        try {
          const { type, data } = JSON.parse(payload)
          this.walletController.handleMessage(socketId, type, data)
        } catch (error) {
          console.error('Error processing message:', error)
        }
      })
    })
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', async () => {
      await this.wss.close()
      await this.walletController.cleanup()
      process.exit(0)
    })
  }
}

