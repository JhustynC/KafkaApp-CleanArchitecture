import { Kafka, logLevel } from 'kafkajs';
import { KafkaTopics } from '../../events';
import { Spot } from '@binance/connector';

export class PriceService {
  private readonly btcUsdtTicker = 'btcusdt';
  private readonly ethUsdtTicker = 'ethusdt';
  private readonly producer;
  private readonly client = new Spot();
  private wsRef: any;

  constructor(private readonly kafkaBroker: string) {
    const kafka = new Kafka({
      brokers: [this.kafkaBroker],
      logLevel: logLevel.ERROR
    });
    this.producer = kafka.producer();
  }

  public async start(): Promise<void> {
    await this.producer.connect();

    const callbacks = {
      message: async (json: string) => {
        const { stream, data } = JSON.parse(json);
        const currency = stream.split('usdt@ticker')[0];
        const price = Number(data.c);

        const payload = JSON.stringify({ price });
        await this.producer.send({
          topic: KafkaTopics.CurrencyPrice,
          messages: [{ key: currency, value: payload }],
        });
      },
    };

    this.wsRef = this.client.combinedStreams(
      [`${this.btcUsdtTicker}@ticker`, `${this.ethUsdtTicker}@ticker`],
      callbacks
    );

    console.log('Price service started successfully');
  }

  public async stop(): Promise<void> {
    if (this.wsRef) {
      this.client.unsubscribe(this.wsRef);
    }
    await this.producer.disconnect();
  }
}

export default PriceService;
