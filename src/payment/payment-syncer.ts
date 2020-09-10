import { firestore } from 'firebase-admin'
import { injectable, inject } from 'inversify'
import Stripe from 'stripe'
import { FirestoreClient, StripeClient } from '../clients'

@injectable()
export class PaymentSyncer {
    @inject(FirestoreClient) private firestoreClient!: FirestoreClient
    @inject(StripeClient) private stripeClient!: StripeClient

    private collectionRef?: firestore.CollectionReference
    private batch?: firestore.WriteBatch
    private priceIds?: Map<string, { price: number, productId: string }>

    async syncToStripe() {
        this.priceIds = await this.getStripePrices()
        this.collectionRef = this.firestoreClient.connect().collection('product')
        this.batch = this.firestoreClient.connect().batch()

        const snapshots = await this.collectionRef.get()
        for await (let doc of snapshots.docs) {
            let document = doc.data()
            let priceId: string = document['stripe']

            if(priceId != undefined) {
                if(this.priceIds.get(priceId)?.price != document['price']) {
                    priceId = await this.updatePrice(document, doc.id)
                    this.batch.update(this.collectionRef.doc(doc.id), { stripe: priceId })
                }

                this.priceIds!.delete(priceId)
            } else {
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

    async getStripePrices() {
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
                name: document['name'],
                metadata: { dbId: id }
            })
        } catch (err) {
            throw new Error(err)
        }

        try {
            price = await this.stripeClient.connect().prices.create({
                product: product.id,
                currency: 'aud',
                unit_amount: document['price']
            })
        } catch (err) {
            throw new Error(err)
        }

        await new Promise(r => setTimeout(r, 5))
        console.log(`Created product: ${document['name']} on Stripe`)
        return price.id
    }

    async updatePrice(document: firestore.DocumentData, id: string) {
        console.log(`Updating ${document['name']} prices to ${document['price']}`)
        let deactivatedPrice: Stripe.Price
        let price: Stripe.Price

        try {
            deactivatedPrice = await this.stripeClient.connect().prices.update(document['stripe'], { active: false })
        } catch (err) {
            throw new Error(err)
        }

        try {
            price = await this.stripeClient.connect().prices.create({
                product: deactivatedPrice.product as string,
                currency: 'aud',
                unit_amount: document['price']
            })
        } catch (err) {
            throw new Error(err)
        }

        await new Promise(r => setTimeout(r, 5))
        console.log(`Updated price of product: ${document['name']} on Stripe`)
        return price.id
        
    }

    async disableDanglingStripePrices() {
        for await (let [key, value] of this.priceIds!) {
            await this.stripeClient.connect().products.update(value.productId, { active: false })
            await this.stripeClient.connect().prices.update(key)
            await new Promise(r => setTimeout(r, 10))
            console.log(`Disabled product ID: ${value.productId} on Stripe`)
        }
    }
}