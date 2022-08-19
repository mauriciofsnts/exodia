import { Client } from "discord.js";
import { loadEnvs } from "../config/env.helper";

export class ExodiaClient {


    start() {
        loadEnvs()
    }

}