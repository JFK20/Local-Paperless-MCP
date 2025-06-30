export class Logger {
    private static instance: Logger;

    constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public info(message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] INFO: ${message}`;

        if (data) {
            process.stderr.write(`${logMessage} ${JSON.stringify(data)}\n`);
        } else {
            process.stderr.write(`${logMessage}\n`);
        }
    }

    public error(message: string, error?: any) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ERROR: ${message}`;

        if (error) {
            process.stderr.write(`${logMessage} ${error.stack || error}\n`);
        } else {
            process.stderr.write(`${logMessage}\n`);
        }
    }

    public debug(message: string, data?: any) {
        if (process.env.NODE_ENV === "development") {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] DEBUG: ${message}`;

            if (data) {
                process.stderr.write(
                    `${logMessage} ${JSON.stringify(data, null, 2)}\n`
                );
            } else {
                process.stderr.write(`${logMessage}\n`);
            }
        }
    }

    public warn(message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] WARN: ${message}`;

        if (data) {
            process.stderr.write(`${logMessage} ${JSON.stringify(data)}\n`);
        } else {
            process.stderr.write(`${logMessage}\n`);
        }
    }
}
