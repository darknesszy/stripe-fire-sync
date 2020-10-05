import { firestore } from 'firebase-admin'
import { injectable } from 'inversify'
import { ProductETL } from './product-etl'

@injectable()
export class ShopifyProductETL extends ProductETL {
    constructor() { super()

    }

    async syncToStripe(collectionName: string) {
        super.syncToStripe(collectionName, { nameKey: 'title', priceKey: 'costperitem' })
    }

    protected getUnitAmount(document: firestore.DocumentData) {
        return document[this.priceKey] * 100
    }
}