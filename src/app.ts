import { envs } from "./config/adapters/envs.adapter"
import { Server } from "./presentation/server"


(async () => {
    console.table(envs);
    
    const server = new Server(
        envs.KAFKA_BROKER, 
        envs.PORT
    );

    server.init()
})()
