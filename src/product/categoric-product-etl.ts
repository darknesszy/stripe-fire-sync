import { firestore } from 'firebase-admin'
import { injectable } from 'inversify'
import { ProductETL } from './product-etl'
import { CategoricProductOptions } from './product-options'
import startCase from 'lodash/startcase'

@injectable()
export class CategoricProductETL extends ProductETL {
    private categoryKey: string = this.nameKey

    constructor() { super()

    }

    async syncToStripe(collectionName: string, options: CategoricProductOptions) {
        this.categoryKey = options.categoryKey
        super.syncToStripe(collectionName, options)
    }

    protected getProductName(document: firestore.DocumentData) {
        return `${document[this.nameKey]} ${startCase(document[this.categoryKey])}`
    }
}