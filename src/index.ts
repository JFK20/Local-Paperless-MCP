import { McpOpenAIBridge } from "./mcpOpenAIBridge.js";
import "dotenv/config";

// Start the bridge
const bridge = new McpOpenAIBridge();
bridge.start().catch(console.error);
