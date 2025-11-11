import { envs } from "./config/adapters/envs.adapter.js"
import { Server } from "./presentation/server.js"


(async () => {
    try {
        console.table(envs);
        
        const server = new Server({
            kafkaBroker: envs.KAFKA_BROKER,
            port: envs.PORT,
            blockcypherApiUrl: envs.BLOCKCYPHER_API_URL,
            blockcypherToken: envs.BLOCKCYPHER_TOKEN,
            consumerGroupId: envs.KAFKA_CONSUMER_GROUP_ID
        });
        
        await server.init()
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
})()
