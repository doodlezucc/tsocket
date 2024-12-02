import { Configuration } from "./configuration.ts";

export interface Socket<T extends Configuration> {
    receive() {}
}
