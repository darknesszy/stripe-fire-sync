import { injectable } from "inversify"
import { initializeApp, credential, app } from "firebase-admin"

@injectable()
export class FirestoreClient {
    constructor() {
        initializeApp({
            credential: credential.cert(require(process.env['GOOGLE_APPLICATION_CREDENTIALS']!)),
            projectId: process.env['PROJECT_ID'],
            databaseURL: `https://${process.env['PROJECT_ID']}.firebaseio.com`
        })
    }

    connect() {
        return app().firestore()
    }

    dispose() {
        app().delete()
    }
}