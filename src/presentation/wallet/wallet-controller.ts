// wallet-controller.ts
import { WebSocket } from 'ws'
import { Kafka, Consumer, Producer } from 'kafkajs'
import { getCurrencyFromAddress, sendSocketMessage } from '../utils/utils'
import { KafkaTopics, WebSocketEvents } from "../../domain/events/events"
import { WalletService } from '../services/wallet/wallet.service'

export class WalletController {
  private readonly producer: Producer
  private readonly priceConsumer: Consumer
  private readonly balanceConsumer: Consumer
  private readonly errorConsumer: Consumer
  private readonly priceConsumerGroupId: string
  private readonly balanceConsumerGroupId: string
  private readonly errorConsumerGroupId: string
  private readonly clients = new Map<string, WebSocket>()
  private readonly clientWallets = new Map<string, { address: string; currency: string }>()
  private readonly walletBalances = new Map<string, number>()
  private readonly prices: Record<string, number | null> = { btc: null, eth: null }

  private readonly walletService: WalletService

  constructor(private readonly kafka: Kafka) {
    // Usar el broker de la configuración de Kafka
    const kafkaBroker = 'localhost:9092'; // Valor por defecto
    this.walletService = new WalletService(kafkaBroker)
    this.priceConsumerGroupId = `server-price-${Date.now()}`
    this.balanceConsumerGroupId = `server-balance-${Date.now()}`
    this.errorConsumerGroupId = `server-error-${Date.now()}`

    this.producer = kafka.producer();
    
    this.priceConsumer = this.kafka.consumer({ groupId: this.priceConsumerGroupId })
    this.balanceConsumer = this.kafka.consumer({ groupId: this.balanceConsumerGroupId })
    this.errorConsumer = this.kafka.consumer({ groupId: this.errorConsumerGroupId })
  }

  public async initialize(): Promise<void> {
    await this.connectKafka()
    await this.walletService.start()
    await this.setupConsumers()
  }

  public addClient(socketId: string, ws: WebSocket): void {
    this.clients.set(socketId, ws)
  }

  public removeClient(socketId: string): void {
    this.clients.delete(socketId)
    this.clientWallets.delete(socketId)
  }

  public async handleMessage(socketId: string, type: string, data: any): Promise<void> {
    console.log('[message from client]', { socketId, type, data })

    switch (type) {
      case WebSocketEvents.SetupWallet:
        await this.handleSetupWallet(socketId, data)
        break
      case WebSocketEvents.ReadBalance:
        await this.handleReadBalance(socketId)
        break
    }
  }

  public async cleanup(): Promise<void> {
    await this.priceConsumer.disconnect()
    await this.balanceConsumer.disconnect()
    await this.errorConsumer.disconnect()
    await this.kafka.admin().deleteGroups([this.priceConsumerGroupId, this.balanceConsumerGroupId, this.errorConsumerGroupId])
    await this.producer.disconnect()
  }

  private async connectKafka(): Promise<void> {
    await this.priceConsumer.connect()
    await this.balanceConsumer.connect()
    await this.errorConsumer.connect()
    await this.producer.connect()
    await this.priceConsumer.subscribe({ topic: KafkaTopics.CurrencyPrice, fromBeginning: false })
    await this.balanceConsumer.subscribe({ topic: KafkaTopics.WalletBalance, fromBeginning: false })
    await this.errorConsumer.subscribe({ topic: KafkaTopics.WalletBalanceError, fromBeginning: false })
  }

  private async setupConsumers(): Promise<void> {
    await this.priceConsumer.run({
      eachMessage: async ({ message }) => {
        const { price } = JSON.parse(message.value!.toString())
        const currency = message.key!.toString()
        this.prices[currency] = price
        this.notifyClientsAboutPriceUpdate(currency, price)
      },
    })

    await this.balanceConsumer.run({
      eachMessage: async ({ message }) => {
        const { balance } = JSON.parse(message.value!.toString())
        const address = message.key!.toString()
        this.walletBalances.set(address, balance)
        this.notifyClientsAboutBalanceUpdate(address, balance)
      },
    })

    await this.errorConsumer.run({
      eachMessage: async ({ message }) => {
        const { address, error, isNotFound } = JSON.parse(message.value!.toString())
        this.notifyClientsAboutError(address, error, isNotFound)
      },
    })
  }

  private async handleSetupWallet(socketId: string, address: string): Promise<void> {
    const currency = getCurrencyFromAddress(address)
    this.clientWallets.set(socketId, { address, currency })

    const price = this.prices[currency]
    if (price) {
      this.notifyClient(socketId, WebSocketEvents.PriceUpdated, { price })
    }

    const balance = this.walletBalances.get(address)
    if (balance) {
      this.notifyClient(socketId, WebSocketEvents.BalanceUpdated, { balance })
    } else {
      await this.requestBalanceCrawl(address, currency)
    }
  }

  private async handleReadBalance(socketId: string): Promise<void> {
    const wallet = this.clientWallets.get(socketId)
    if (wallet) {
      await this.requestBalanceCrawl(wallet.address, wallet.currency)
    }
  }

  private async requestBalanceCrawl(address: string, currency: string): Promise<void> {
    const payload = JSON.stringify({ address, currency })
    await this.producer.send({
      topic: KafkaTopics.TaskToReadBalance,
      messages: [{ key: address, value: payload }],
    })
  }

  private notifyClientsAboutPriceUpdate(currency: string, price: number): void {
    this.clientWallets.forEach((wallet, clientId) => {
      if (wallet.currency === currency) {
        this.notifyClient(clientId, WebSocketEvents.PriceUpdated, { price })
      }
    })
  }

  private notifyClientsAboutBalanceUpdate(address: string, balance: number): void {
    this.clientWallets.forEach((wallet, clientId) => {
      if (wallet.address === address) {
        this.notifyClient(clientId, WebSocketEvents.BalanceUpdated, { balance })
      }
    })
  }

  private notifyClientsAboutError(address: string, error: string, isNotFound: boolean): void {
    this.clientWallets.forEach((wallet, clientId) => {
      if (wallet.address === address) {
        this.notifyClient(clientId, WebSocketEvents.Error, { 
          error, 
          isNotFound,
          address 
        })
      }
    })
  }

  private notifyClient(clientId: string, event: string, data: any): void {
    const ws = this.clients.get(clientId)
    if (ws) {
      sendSocketMessage(ws, event, data)
    }
  }
}
