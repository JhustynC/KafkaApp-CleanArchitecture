import { envs } from "./config/envs.adapter"
import { Server } from "./presentation/server"


(async () => {
    console.table(envs);
    
    const server = new Server(
        envs.KAFKA_BROKER, 
        envs.PORT
    );

    server.init()
})()