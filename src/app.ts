import { envs } from "./config/adapters/envs.adapter"
import { Server } from "./presentation/server"


(async () => {
    console.table(envs);
    
    const server = new Server({
        kafkaBroker: envs.KAFKA_BROKER,
        port: envs.PORT,
        blockcypherApiUrl: envs.BLOCKCYPHER_API_URL,
        blockcypherToken: envs.BLOCKCYPHER_TOKEN,
        consumerGroupId: envs.KAFKA_CONSUMER_GROUP_ID
    });
    
    server.init()
})()
