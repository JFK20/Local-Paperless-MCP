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
        if (parseInt(process.env.LOGGER_LEVEL) < 1) {
            return;
        }
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
        if (parseInt(process.env.LOGGER_LEVEL) < 2) {
            return;
        }
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
