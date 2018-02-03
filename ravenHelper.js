var DocumentStore = require('ravendb').default;

const store = DocumentStore.create('http://192.168.0.15:8080', 'build-release');
store.initialize();

module.exports = {
    createSiteBuild: async function (hash, message) {
        const session = store.openSession();

        let version = await session.load('Versioning/SiteBuild');
        version.Build = version.Build + 1;
        let newSiteVersion = version.Major + '.' + version.Minor + '.' + version.Build;

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

        return data;
    },
    createApiBuild: async function (hash, message) {
        const session = store.openSession();

        let version = await session.load('Versioning/ApiBuild');
        version.Build = version.Build + 1;
        let newApiVersion = version.Major + '.' + version.Minor + '.' + version.Build;

        let data = {
            version: newApiVersion,
            status: 'STARTED',
            hash: hash,
            message: message,
            created: new Date(),
            updated: null
        };
        data = await session.store(data, 'ApiBuilds/');
        await session.store(version);
        await session.saveChanges();

        return data;
    },
    updateData: async function (id, status) {
        const session = store.openSession();
        data = await session.load(id);
        data.status = status;
        data.updated = new Date();

        await session.store(data);
        await session.saveChanges();
    }
};