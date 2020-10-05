import { firestore, initializeApp, credential } from 'firebase-admin'

export const clearStripeIds = async (collectionName: string) => {
    const db = firestore(
        initializeApp({
            credential: credential.cert(require(process.env['GOOGLE_APPLICATION_CREDENTIALS']!)),
            databaseURL: `https://${process.env['PROJECT_ID']}.firebaseio.com`
        })
    )

    const batch = db.batch()
    const snapshots = await db.collection(collectionName).get()
    snapshots.forEach(el => batch.update(el.ref, { stripe: firestore.FieldValue.delete() }))
    await batch.commit()
    console.log(`All stripe id removed from collection: ${collectionName}`)
}