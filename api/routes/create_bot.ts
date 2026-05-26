import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { CreateBotRequest } from "../structure/create_bot.js";


export default async function createBotRoute(fastify:FastifyInstance,options:FastifyPluginOptions) {
    fastify.post<{Body : CreateBotRequest}>("/create_bot",async (request,reply)=>{
        const {name,server,port,password} = request.body;
        
    })

    
}