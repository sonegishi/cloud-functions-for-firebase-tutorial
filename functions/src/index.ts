import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

export const getBostonAreaWeather =
functions.https.onRequest(async (request, response) => {
    try {
        const areaSnapshot = await admin.firestore().doc('areas/greater-boston').get()
        const cities = areaSnapshot.data()?.cities ?? null
        const promises: Promise<FirebaseFirestore.DocumentSnapshot>[] = []
        for (const city in cities) {
            const p = admin.firestore().doc(`cities-weather/${city}`).get()
            promises.push(p)
        }
        const citySnapshots = Promise.all(promises)

        const results: (FirebaseFirestore.DocumentData | undefined)[] = [];
        (await citySnapshots).forEach((citySnap: { data: () => any; id: any; }) => {
            const data = citySnap.data()
            data.city = citySnap.id
            results.push(data)
        })
        response.send(results)
    }
    catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

export const onBostonWeatherUpdate =
functions.firestore.document('cities-weather/boston-ma-us').onUpdate(change => {
    const after = change.after.data()
    const payload = {
        data: {
            temp: String(after?.temp) ?? null,
            conditions: after?.conditions ?? null
        }
    }
    return admin.messaging().sendToTopic('weaather_boston-ma-us', payload)
})

export const getBostonWeather =
functions.https.onRequest(async (request, response) => {
    try {
        const snapshot = await admin.firestore().doc('cities-weather/boston-ma-us').get()
        const data = snapshot.data()
        response.send(data)
    }
    catch (error) {
        // Handle the error
        console.log(error)
        response.status(500).send(error)
    }
});


export const onMessageCreate = functions.database
.ref('rooms/{roommId}/messages/{messageId}')
.onCreate((snapshot, context) => {
    const roomId = context.params.roomId
    const messageId = context.params.messageId
    console.log(`New message ${messageId} in room ${roomId}`)

    const messageData = snapshot.val()
    const text = addPizzazz(messageData.text)
    snapshot.ref.update({ text: text })
    .catch(error => { console.log(error) })
})

function addPizzazz(text: string): string {
    return text.replace(/\bpizza\b/g, '🍕')
}

export const onMessageUpdate = functions.database
.ref('rooms/{roommId}/messages/{messageId}')
.onUpdate((change, context) => {
    const before = change.before.val()
    const after = change.after.val()

    if (before.text === after.text) {
        console.log("Text didn't change")
        return null
    }

    const text = addPizzazz(after.text)
    const timeEdited = Date.now()
    return change.after.ref.update({ text, timeEdited })
})
