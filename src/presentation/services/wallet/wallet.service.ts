import axios from 'axios';
import { Kafka, logLevel } from 'kafkajs';
import { KafkaTopics } from '../../../domain/events/events.js';

export class WalletService {
  private readonly blockcypherApiUrl: string;
  private readonly blockcypherToken?: string;
  private readonly producer;
  private taskConsumer;
  
  constructor(
    private readonly kafkaBroker: string,
    blockcypherApiUrl: string,
    blockcypherToken?: string,
    consumerGroupId?: string
  ) {
    this.blockcypherApiUrl = blockcypherApiUrl;
    this.blockcypherToken = blockcypherToken;
    
    const kafka = new Kafka({
      brokers: [this.kafkaBroker],
      logLevel: logLevel.ERROR
    });
    
    this.producer = kafka.producer();
    this.taskConsumer = kafka.consumer({ 
      groupId: consumerGroupId || 'balance-crawler',
      retry: { retries: 0 } 
    });
  }

  public async start(): Promise<void> {
    await this.producer.connect();
    await this.taskConsumer.connect();
    await this.taskConsumer.subscribe({ 
      topic: KafkaTopics.TaskToReadBalance, 
      fromBeginning: false 
    });

    console.log('Wallet service started successfully');
    
    await this.taskConsumer.run({
      eachMessage: async ({ message }) => {
        let address: string = 'unknown';
        let currency: string = 'unknown';
        
        try {
          const parsed = JSON.parse(message.value!.toString());
          address = parsed.address;
          currency = parsed.currency;
          
          const balance = await this.getWalletBalance(currency, address);

          const payload = JSON.stringify({ balance });
          await this.producer.send({
            topic: KafkaTopics.WalletBalance,
            messages: [{ key: address, value: payload }],
          });
        } catch (error: any) {
          // Si address no se pudo parsear, intentar obtenerlo del mensaje
          if (address === 'unknown') {
            try {
              const parsed = JSON.parse(message.value!.toString());
              address = parsed.address || 'unknown';
              currency = parsed.currency || 'unknown';
            } catch {
              // Ya tiene valores por defecto
            }
          }
          
          const errorMessage = this.extractErrorMessage(error);
          const isRateLimit = this.isRateLimitError(error);
          const isNotFound = error?.response?.status === 404;
          
          console.error(`Error processing wallet balance for ${address}:`, errorMessage);
          
          // Enviar error al cliente a través de un topic de errores
          const errorPayload = JSON.stringify({ 
            address, 
            error: errorMessage,
            isNotFound,
            isRateLimit
          });
          await this.producer.send({
            topic: KafkaTopics.WalletBalanceError,
            messages: [{ key: address, value: errorPayload }],
          });
        }
      },
    });
  }

  public async stop(): Promise<void> {
    await this.taskConsumer.disconnect();
    await this.producer.disconnect();
  }

  private async getWalletBalance(currency: string, address: string): Promise<number> {
    let url = `${this.blockcypherApiUrl}/${currency}/main/addrs/${address}/balance`;
    if (this.blockcypherToken) {
      url += `?token=${this.blockcypherToken}`;
    }

    try {
      const { data } = await axios.get(url);

      if (currency === 'btc') return data.balance / 100000000;
      return data.balance / 1000000000000000000; // For ETH and other tokens
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Wallet address ${address} not found`);
      }
      throw error;
    }
  }

  private extractErrorMessage(error: any): string {
    // Detectar rate limit (429) o límites alcanzados
    if (error.response?.status === 429) {
      return 'Rate limit exceeded. Please wait before trying again.';
    }
    
    if (error.response?.data?.error) {
      const errorMsg = error.response.data.error;
      // Detectar mensajes de límites alcanzados
      if (errorMsg.toLowerCase().includes('limit') || errorMsg.toLowerCase().includes('rate')) {
        return 'API rate limit reached. Please wait or upgrade your BlockCypher token.';
      }
      return errorMsg;
    }
    
    if (error.message) {
      // Detectar mensajes de límites en el error message
      if (error.message.toLowerCase().includes('limit') || error.message.toLowerCase().includes('rate')) {
        return 'API rate limit reached. Please wait or upgrade your BlockCypher token.';
      }
      return error.message;
    }
    
    return 'Unknown error occurred';
  }
  
  private isRateLimitError(error: any): boolean {
    return (
      error.response?.status === 429 ||
      error.response?.data?.error?.toLowerCase().includes('limit') ||
      error.response?.data?.error?.toLowerCase().includes('rate') ||
      error.message?.toLowerCase().includes('limit') ||
      error.message?.toLowerCase().includes('rate')
    );
  }
}

export default WalletService;

