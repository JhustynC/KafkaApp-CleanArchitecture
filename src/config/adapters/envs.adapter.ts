import "dotenv/config";
import { get } from "env-var";

export const envs = {
    KAFKA_BROKER: get('KAFKA_BROKER').default('localhost:9092').asString(),
    PORT: get('PORT').default(3000).asPortNumber(),
    WEBSOCKET_URL: get('WEBSOCKET_URL').default('ws://localhost:3000').asString(),
    BLOCKCYPHER_API_URL: get('BLOCKCYPHER_API_URL').default('https://api.blockcypher.com/v1').asString(),
    BLOCKCYPHER_TOKEN: get('BLOCKCYPHER_TOKEN').asString(),
    KAFKA_CONSUMER_GROUP_ID: get('KAFKA_CONSUMER_GROUP_ID').default('balance-crawler').asString()
};

