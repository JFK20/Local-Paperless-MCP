import axios from "axios";
import { PaperlessAPI } from "./paperlessAPI.js";

/**
 * Tests connection to Paperless NGX API
 * @param paperlessAPI Paperless API instance
 * @returns true if connection is successful, false otherwise
 */
export async function testPaperlessConnection(
    paperlessAPI: PaperlessAPI
): Promise<boolean> {
    try {
        const headers = paperlessAPI.getPaperlessHeaders();
        await axios.get(`${paperlessAPI.paperlessConfig.baseUrl}/api/`, {
            headers,
        });
        return true;
    } catch (error: any) {
        console.error("Paperless NGX connection failed:", error.message);
        return false;
    }
}
