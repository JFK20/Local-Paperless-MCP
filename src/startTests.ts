import axios from "axios";
import { PaperlessAPI } from "./paperlessAPI.js";
import { OllamaConfig } from "./types.js";

/**
 * Tests connection to Ollama API
 * @param ollamaConfig Configuration for Ollama
 * @returns true if connection is successful, false otherwise
 */
export async function testOllamaConnection(ollamaConfig: OllamaConfig): Promise<boolean> {
    try {
        await axios.get(`${ollamaConfig.baseUrl}/api/tags`);
        console.log("Ollama connection successful");
        return true;
    } catch (error: any) {
        console.error("Ollama connection failed:", error.message);
        return false;
    }
}

/**
 * Tests connection to Paperless NGX API
 * @param paperlessAPI Paperless API instance
 * @returns true if connection is successful, false otherwise
 */
export async function testPaperlessConnection(paperlessAPI: PaperlessAPI): Promise<boolean> {
    try {
        const headers = paperlessAPI.getPaperlessHeaders();
        await axios.get(
            `${paperlessAPI.paperlessConfig.baseUrl}/api/`,
            {
                headers,
            }
        );
        console.log("Paperless NGX connection successful");
        return true;
    } catch (error: any) {
        console.error("Paperless NGX connection failed:", error.message);
        return false;
    }
}
