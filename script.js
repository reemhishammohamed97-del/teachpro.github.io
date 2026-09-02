(() => {
    let timerId = null;

    function showTime() {
        const currentTime = document.getElementById('currentTime');

        if (!currentTime) {
            if (timerId !== null) {
                clearInterval(timerId);
                timerId = null;
            }
            return;
        }

        currentTime.textContent = new Date().toLocaleString('ar-SA', {
            dateStyle: 'medium',
            timeStyle: 'medium'
        });
    }

    function initializeClock() {
        showTime();

        if (document.getElementById('currentTime') && timerId === null) {
            timerId = setInterval(showTime, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeClock, { once: true });
    } else {
        initializeClock();
    }

    /*
     * Firestore collections:
     * users/{uid}/classes
     * users/{uid}/schedules
     * users/{uid}/reports
     * users/{uid}/sessionTrackers
     * users/{uid}/files
     */

    const COLLECTIONS = [
        'classes',
        'schedules',
        'reports',
        'sessionTrackers',
        'files'
    ];

    function getUserCollection(uid, collectionName) {
        return db.collection('users').doc(uid).collection(collectionName);
    }

    function removeUndefinedValues(value) {
        if (Array.isArray(value)) {
            return value.map(removeUndefinedValues);
        }

        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value)
                    .filter(([, item]) => item !== undefined)
                    .map(([key, item]) => [key, removeUndefinedValues(item)])
            );
        }

        return value;
    }

    async function readCollection(uid, collectionName) {
        const snapshot = await getUserCollection(uid, collectionName).get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async function syncCollection(uid, collectionName, items) {
        const collection = getUserCollection(uid, collectionName);
        const snapshot = await collection.get();
        const currentIds = new Set(snapshot.docs.map(doc => doc.id));
        const newIds = new Set();

        const chunks = [];

        for (let index = 0; index < items.length; index += 400) {
            chunks.push(items.slice(index, index + 400));
        }

        for (const chunk of chunks) {
            const batch = db.batch();

            chunk.forEach(item => {
                const id = String(item.id || newId());
                newIds.add(id);

                const reference = collection.doc(id);
                const data = removeUndefinedValues({
                    ...item,
                    id
                });

                batch.set(reference, data);
            });

            await batch.commit();
        }

        const idsToDelete = [...currentIds].filter(id => !newIds.has(id));

        for (let index = 0; index < idsToDelete.length; index += 400) {
            const batch = db.batch();

            idsToDelete.slice(index, index + 400).forEach(id => {
                batch.delete(collection.doc(id));
            });

            await batch.commit();
        }
    }

    async function saveCollections(uid, data) {
        for (const collectionName of COLLECTIONS) {
            const items = Array.isArray(data[collectionName])
                ? data[collectionName]
                : [];

            await syncCollection(uid, collectionName, items);
        }
    }

    async function loadCollections(uid) {
        const result = await Promise.all(
            COLLECTIONS.map(collectionName =>
                readCollection(uid, collectionName)
            )
        );

        const data = {};

        COLLECTIONS.forEach((collectionName, index) => {
            data[collectionName] = result[index];
        });

        return data;
    }

    function hasCollectionData(data) {
        return COLLECTIONS.some(collectionName =>
            Array.isArray(data[collectionName]) &&
            data[collectionName].length > 0
        );
    }

    async function migrateLegacyData(uid, legacyData) {
        const normalized = normalizeDB(legacyData || {});
        await saveCollections(uid, normalized);
        return normalized;
    }

    /*
     * Replace the old single-document saveData function.
     */
    window.saveData = function saveDataUsingCollections() {
        if (!currentUser) {
            return Promise.reject(
                new Error('لا يوجد مستخدم مسجل الدخول')
            );
        }

        const uid = currentUser.uid;
        const dataToSave = clone(DB);

        saveQueue = saveQueue
            .catch(() => {})
            .then(async () => {
                if (!currentUser || currentUser.uid !== uid) {
                    throw new Error('تغير المستخدم أثناء الحفظ');
                }

                await saveCollections(uid, dataToSave);

                // إزالة البيانات القديمة بعد نجاح الترحيل
                await db.collection('users').doc(uid).set({
                    migratedToCollections: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

        return saveQueue;
    };

    /*
     * Replace the old single-document loadData function.
     */
    window.loadData = async function loadDataFromCollections(uid = currentUser?.uid) {
        if (!uid) return;

        const userReference = db.collection('users').doc(uid);
        const collectionData = await loadCollections(uid);

        if (currentUser?.uid !== uid) return;

        if (hasCollectionData(collectionData)) {
            DB = normalizeDB(collectionData);
            renderAll();
            return;
        }

        // ترحيل البيانات القديمة الموجودة داخل db
        const legacySnapshot = await userReference.get();
        const legacyData = legacySnapshot.exists
            ? legacySnapshot.data()?.db
            : null;

        if (legacyData) {
            DB = await migrateLegacyData(uid, legacyData);
        } else {
            DB = emptyDB();
        }

        renderAll();
    };
})();