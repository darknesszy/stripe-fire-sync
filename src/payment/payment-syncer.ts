import { firestore, initializeApp, credential } from 'firebase-admin'
import { injectable } from 'inversify'
import Stripe from 'stripe'

@injectable()
export class PaymentSyncer {
    private firestoreClient: firestore.Firestore
    private stripeClient: Stripe
    private collectionRef?: firestore.CollectionReference
    private batch?: firestore.WriteBatch
    private priceIds?: Map<string, { price: number, productId: string }>

    constructor() {
        this.firestoreClient = firestore(
            initializeApp({
                credential: credential.cert(require(process.env['GOOGLE_APPLICATION_CREDENTIALS']!)),
                databaseURL: `https://${process.env['PROJECT_ID']}.firebaseio.com`
            })
        )

        this.stripeClient = new Stripe(
            process.env['STRIPE_PUBLIC_KEY']!,
            {
                apiVersion: '2020-08-27',
                typescript: true
            }
        )
    }

    async syncToStripe() {
        this.priceIds = await this.getStripePrices()
        this.collectionRef = this.firestoreClient.collection('product')
        this.batch = this.firestoreClient.batch()

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
        const prices = await this.stripeClient.prices.list({ active: true, limit: 100 })
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
            product = await this.stripeClient.products.create({
                name: document['name'],
                metadata: { dbId: id }
            })
        } catch (err) {
            throw new Error(err)
        }

        try {
            price = await this.stripeClient.prices.create({
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
            deactivatedPrice = await this.stripeClient.prices.update(document['stripe'], { active: false })
        } catch (err) {
            throw new Error(err)
        }

        try {
            price = await this.stripeClient.prices.create({
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
            await this.stripeClient.products.update(value.productId, { active: false })
            await this.stripeClient.prices.update(key)
            await new Promise(r => setTimeout(r, 10))
            console.log(`Disabled product ID: ${value.productId} on Stripe`)
        }
    }
}