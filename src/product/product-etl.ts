import { firestore } from 'firebase-admin'
import { injectable, inject } from 'inversify'
import Stripe from 'stripe'
import { FirestoreClient, StripeClient } from '../clients'
import { ProductOptions } from './product-options'

@injectable()
export class ProductETL {
    @inject(FirestoreClient) private firestoreClient!: FirestoreClient
    @inject(StripeClient) private stripeClient!: StripeClient

    protected priceKey: string = 'price'
    protected nameKey: string = 'name'
    private collectionRef?: firestore.CollectionReference
    private batch?: firestore.WriteBatch
    private existingPriceIds?: Map<string, { price: number, productId: string }>

    async syncToStripe(collectionName: string, options?: ProductOptions) {
        if(options && options.priceKey) this.priceKey = options.priceKey
        if(options && options.nameKey) this.nameKey = options.nameKey

        this.existingPriceIds = await this.getStripePriceIds()
        this.collectionRef = this.firestoreClient.connect().collection(collectionName)
        this.batch = this.firestoreClient.connect().batch()

        const snapshots = await this.collectionRef.get()
        for await (let doc of snapshots.docs) {
            const document = doc.data()
            const price: number = document[this.priceKey]
            let priceId: string = document['stripe']

            if(priceId != undefined) {
                if(this.existingPriceIds.get(priceId)?.price != price) {
                    priceId = await this.updatePrice(document)
                    this.batch.update(this.collectionRef.doc(doc.id), { stripe: priceId })
                }

                this.existingPriceIds!.delete(priceId)
            } else if(price != 0) {
                priceId = await this.createProduct(document, doc.id)
                this.batch.update(this.collectionRef.doc(doc.id), { stripe: priceId })
            }
        }

        try {
            await this.batch.commit()
        } catch (err) {
            throw Error(err)
        }

        this.disableDanglingStripePrices()
        console.log('All product price changes updated successfully')
    }

    async getStripePriceIds() {
        const prices = await this.stripeClient.connect().prices.list({ active: true, limit: 100 })
        await new Promise(r => setTimeout(r, 5))
        return new Map(
            prices.data.map(el => 
                [el.id, { price: el.unit_amount || 0, productId: el.product as string }]
            )
        )
    }

    async createProduct(document: firestore.DocumentData, id: string) {
        let product: Stripe.Product
        let price: Stripe.Price

        try {
            product = await this.stripeClient.connect().products.create({
                name: this.getProductName(document),
                metadata: { dbId: id }
            })
        } catch (err) {
            throw new Error(err)
        }

        try {
            price = await this.stripeClient.connect().prices.create({
                product: product.id,
                currency: 'aud',
                unit_amount: this.getUnitAmount(document)
            })
        } catch (err) {
            throw new Error(err)
        }

        await new Promise(r => setTimeout(r, 5))
        console.log(`Created product: ${this.getProductName(document)} on Stripe`)
        return price.id
    }

    async updatePrice(document: firestore.DocumentData) {
        console.log(`Updating ${this.getProductName(document)} prices to ${document[this.priceKey]}`)
        let deactivatedPrice: Stripe.Price
        let price: Stripe.Price

        try {
            deactivatedPrice = await this.stripeClient
                .connect()
                .prices
                .update(document[this.priceKey], { active: false })
        } catch (err) {
            throw new Error(err)
        }

        try {
            price = await this.stripeClient.connect().prices.create({
                product: deactivatedPrice.product as string,
                currency: 'aud',
                unit_amount: this.getUnitAmount(document)
            })
        } catch (err) {
            throw new Error(err)
        }

        await new Promise(r => setTimeout(r, 5))
        console.log(`Updated price of product: ${this.getProductName(document)} on Stripe`)
        return price.id
        
    }

    async disableDanglingStripePrices() {
        for await (let [key, value] of this.existingPriceIds!) {
            await this.stripeClient.connect().products.update(value.productId, { active: false })
            await this.stripeClient.connect().prices.update(key)
            await new Promise(r => setTimeout(r, 10))
            console.log(`Disabled product ID: ${value.productId} on Stripe`)
        }
    }

    protected getProductName(document: firestore.DocumentData) {
        return document[this.nameKey]
    }

    protected getUnitAmount(document: firestore.DocumentData) {
        return document[this.priceKey]
    }
}