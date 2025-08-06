import { PaperlessAPI } from "./paperlessAPI.js";
import { Logger } from "./logger.js";
import { components } from "./types/gen_paperless.js";

export class CachedMetadata {
    private static instance: CachedMetadata;
    private tags: Map<number, components["schemas"]["Tag"]> = new Map();
    private correspondents: Map<
        number,
        components["schemas"]["Correspondent"]
    > = new Map();
    private documentTypes: Map<number, components["schemas"]["DocumentType"]> =
        new Map();
    private lastUpdated: Date | null = null;
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    static getInstance(): CachedMetadata {
        if (!CachedMetadata.instance) {
            CachedMetadata.instance = new CachedMetadata();
        }
        return CachedMetadata.instance;
    }

    async initialize(paperlessAPI: PaperlessAPI): Promise<void> {
        this.logger.debug("Initializing metadata cache...");

        try {
            await Promise.all([
                this.loadTags(paperlessAPI),
                this.loadCorrespondents(paperlessAPI),
                this.loadDocumentTypes(paperlessAPI),
            ]);

            this.lastUpdated = new Date();
            this.logger.info(
                `Metadata cache initialized with ${this.tags.size} tags, ${this.correspondents.size} correspondents, and ${this.documentTypes.size} document types`
            );
        } catch (error) {
            this.logger.error("Failed to initialize metadata cache", error);
            throw error;
        }
    }

    private async loadTags(paperlessAPI: PaperlessAPI): Promise<void> {
        try {
            const response = await paperlessAPI.listTagsRaw();
            if (response.results.length > 0) {
                const tags = response.results;
                this.tags.clear();
                tags.forEach((tag: components["schemas"]["Tag"]) => {
                    if (tag.id) {
                        this.tags.set(tag.id, tag);
                    }
                });
            }
        } catch (error) {
            this.logger.error("Failed to load tags", error);
            throw error;
        }
    }

    private async loadCorrespondents(
        paperlessAPI: PaperlessAPI
    ): Promise<void> {
        try {
            const response = await paperlessAPI.listCorrespondentsRaw();
            if (response.results.length > 0) {
                this.correspondents.clear();
                const correspondents = response.results;
                correspondents.forEach(
                    (correspondent: components["schemas"]["Correspondent"]) => {
                        if (correspondent.id) {
                            this.correspondents.set(
                                correspondent.id,
                                correspondent
                            );
                        }
                    }
                );
            }
        } catch (error) {
            this.logger.error("Failed to load correspondents", error);
            throw error;
        }
    }

    private async loadDocumentTypes(paperlessAPI: PaperlessAPI): Promise<void> {
        try {
            const response = await paperlessAPI.listDocumentTypesRaw();
            if (response.results.length > 0) {
                const documentTypes = response.results;
                this.documentTypes.clear();
                documentTypes.forEach(
                    (docType: components["schemas"]["DocumentType"]) => {
                        if (docType.id) {
                            this.documentTypes.set(docType.id, docType);
                        }
                    }
                );
            }
        } catch (error) {
            this.logger.error("Failed to load document types", error);
            throw error;
        }
    }

    async refresh(paperlessAPI: PaperlessAPI): Promise<void> {
        this.logger.info("Refreshing metadata cache...");
        await this.initialize(paperlessAPI);
    }

    getTagsByIds(ids: number[]): components["schemas"]["Tag"][] | undefined {
        if (!ids || ids.length === 0) {
            return undefined;
        }
        return ids
            .map((id) => this.tags.get(id))
            .filter(
                (tag) => tag !== undefined
            ) as components["schemas"]["Tag"][];
    }

    getCorrespondentById(
        id: number
    ): components["schemas"]["Correspondent"] | undefined {
        return this.correspondents.get(id);
    }

    getDocumentTypeById(
        id: number
    ): components["schemas"]["DocumentType"] | undefined {
        return this.documentTypes.get(id);
    }

    getLastUpdated(): Date | null {
        return this.lastUpdated;
    }
}
