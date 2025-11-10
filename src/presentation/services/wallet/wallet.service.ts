import axios from 'axios';
import { Kafka, logLevel } from 'kafkajs';
import { KafkaTopics } from '../../../domain/events/events';

export class WalletService {
  private readonly blockcypherApiUrl = 'https://api.blockcypher.com/v1';
  private readonly blockcypherToken = process.env.BLOCKCYPHER_TOKEN;
  private readonly producer;
  private taskConsumer;
  
  constructor(private readonly kafkaBroker: string) {
    const kafka = new Kafka({
      brokers: [this.kafkaBroker],
      logLevel: logLevel.ERROR
    });
    
    this.producer = kafka.producer();
    this.taskConsumer = kafka.consumer({ 
      groupId: 'balance-crawler',
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
          console.error(`Error processing wallet balance for ${address}:`, errorMessage);
          
          // Enviar error al cliente a través de un topic de errores
          const errorPayload = JSON.stringify({ 
            address, 
            error: errorMessage,
            isNotFound: error?.response?.status === 404 
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
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'Unknown error occurred';
  }
}

export default WalletService;

