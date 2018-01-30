var DocumentStore = require('ravendb').default;

const store = DocumentStore.create('localhost:8080', 'build-deploy');
store.initialize();

module.exports = {
    createSiteBuild: async function (hash, message) {
        const session = store.openSession();

        let version = await store.load('BuildVersions/1');
        let newSiteVersion = version.site + 1;
        version.site = newSiteVersion;
        let data = {
            version: newSiteVersion,
            status: 'STARTED',
            hash: hash,
            message: message,
            created: new Date(),
            updated: null
        };
        data = await session.store(data, 'SiteBuilds/');
        await session.store(version);
        await session.saveChanges();
    },
    createApiBuild: async function (hash, message) {
        const session = store.openSession();

        let version = await store.load('BuildVersions/1');
        let newApiVersion = version.api + 1;
        version.api = newApiVersion;
        let data = {
            version: newSiteVersion,
            status: 'STARTED',
            hash: hash,
            message: message,
            created: new Date(),
            updated: null
        };
        data = await session.store(data, 'ApiBuilds/');
        await session.store(version);
        await session.saveChanges();
    },
    updateData: async function (id, status) {
        const session = store.openSession();
        data = await session.load(data.id);
        data.status = status;
        data.updated = new Date();

        await session.store(data);
        await session.saveChanges();
    }
};