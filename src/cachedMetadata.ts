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

    async initialize(paperlessAPI: PaperlessAPI) {
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

    private async loadTags(paperlessAPI: PaperlessAPI) {
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

    private async loadCorrespondents(paperlessAPI: PaperlessAPI) {
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

    private async loadDocumentTypes(paperlessAPI: PaperlessAPI) {
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

    public async refreshTags(paperlessAPI: PaperlessAPI) {
        this.logger.info("Refreshing Tag cache...");
        await this.loadTags(paperlessAPI);
    }

    public async refreshCorrespondents(paperlessAPI: PaperlessAPI) {
        this.logger.info("Refreshing Correspondent cache...");
        await this.loadCorrespondents(paperlessAPI);
    }

    public async refreshDocumentTypes(paperlessAPI: PaperlessAPI) {
        this.logger.info("Refreshing Document Type cache...");
        await this.loadDocumentTypes(paperlessAPI);
    }

    public getTagsByIds(
        ids: number[]
    ): components["schemas"]["Tag"][] | undefined {
        if (!ids || ids.length === 0) {
            return undefined;
        }
        return ids
            .map((id) => this.tags.get(id))
            .filter(
                (tag) => tag !== undefined
            ) as components["schemas"]["Tag"][];
    }

    public getCorrespondentById(
        id: number
    ): components["schemas"]["Correspondent"] | undefined {
        return this.correspondents.get(id);
    }

    public getDocumentTypeById(
        id: number
    ): components["schemas"]["DocumentType"] | undefined {
        return this.documentTypes.get(id);
    }

    public getTagIDByName(name: string): number | undefined {
        for (const [id, tag] of this.tags.entries()) {
            if (tag.name.trim().toLowerCase() === name.trim().toLowerCase()) {
                return id;
            }
        }
        return undefined;
    }

    public getCorrespondentIDByName(name: string): number | undefined {
        for (const [id, correspondent] of this.correspondents.entries()) {
            if (
                correspondent.name.trim().toLowerCase() ===
                name.trim().toLowerCase()
            ) {
                return id;
            }
        }
        return undefined;
    }

    public getDocumentTypeIDByName(name: string): number | undefined {
        for (const [id, docType] of this.documentTypes.entries()) {
            if (
                docType.name.trim().toLowerCase() === name.trim().toLowerCase()
            ) {
                return id;
            }
        }
        return undefined;
    }

    // If I ever fell like implementing a autoUpdate
    getLastUpdated(): Date | null {
        return this.lastUpdated;
    }
}
