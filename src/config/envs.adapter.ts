import "dotenv/config";
import { get } from "env-var";

export const envs = {
    KAFKA_BROKER: get('KAFKA_BROKER').default('localhost:9092').asString(),
    PORT: get('PORT').default(3000).asPortNumber()
};