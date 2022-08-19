import { Client } from "discord.js";
import { ENVS, loadEnv, setupEnvs } from "../config/env.helper";

export class ExodiaClient extends Client {

    constructor() {
        super({ intents: 32767 })
    }

    start() {
        setupEnvs()
        this.login(loadEnv(ENVS.BOT_TOKEN))
    }

}