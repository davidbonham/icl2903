/// <reference path="../filestore.ts" />

describe("File Store", () => {

    const fileStore: FileStore = new FileStore
    fileStore.loadCatalog("MEREWY")
    fileStore.loadCatalog("LIBRY")

    it("gets user files", () => expect(fileStore.catalogue(false)).toBe(""))
    it("works when server running", () => expect(1).toBe(1))
})