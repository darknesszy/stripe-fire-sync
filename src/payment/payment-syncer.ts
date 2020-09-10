import { firestore, initializeApp, credential } from 'firebase-admin'
import { injectable } from 'inversify'
import Stripe from 'stripe'

@injectable()
export class PaymentSyncer {
    private firestoreClient: firestore.Firestore
    private stripeClient: Stripe
    private collectionRef?: firestore.CollectionReference
    private batch?: firestore.WriteBatch
    private productIds?: Set<string>

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
        this.productIds = await this.getStripeProducts()
        this.collectionRef = this.firestoreClient.collection('product')
        this.batch = this.firestoreClient.batch()

        const snapshots = await this.collectionRef.get()
        for await (const doc of snapshots.docs) {
            let priceId: string

            if (doc.data()['stripe'] != undefined) {
                priceId = await this.updatePrice(doc.data(), doc.id)
            } else {
                priceId = await this.createProduct(doc.data(), doc.id)
            }

            this.batch!.update(this.collectionRef.doc(doc.id), { stripe: priceId })
            await new Promise(r => setTimeout(r, 5))
        }

        try {
            await this.batch.commit()
            console.log('All product price changes updated successfully')
        } catch (err) {
            throw Error(err)
        }

        this.disableProducts()
    }

    async getStripeProducts() {
        const products = await this.stripeClient.products.list()
        return new Set(products.data.map(el => el.id))
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

        this.productIds!.delete(price.product as string)
        console.log(`Updated price of product: ${document['name']} on Stripe`)
        return price.id
        
    }

    async disableProducts() {
        for await (const productId of this.productIds!) {
            await this.stripeClient.products.update(productId, { active: false })
            console.log(`Diabled product ID: ${productId} on Stripe`)
            await new Promise(r => setTimeout(r, 50))
        }
    }

    async getDocuments() {
        const snapshots = await this.firestoreClient.collection('products').get()
        const products = new Array<FProduct>()
        snapshots.forEach(doc => products.push({ ...doc.data() as FProduct, id: doc.id }))

        return products
    }

    async getPriceObjs2() {
        const products = (await this.stripeClient.products.list()).data
        const prices = (await this.stripeClient.prices.list()).data.filter(el => el.active)
        return products.map(product => {
            const price = prices.find(el => el.product == product.id && el.active)
            if (price == undefined) throw Error(`Dangling Product detected: ${product.name} - ${product.id}`)
            return { ...product, price }
        })
    }

    async updateFirebase(changedProducts: Array<{ id: string, stripe: string }>) {
        const collection = this.firestoreClient.collection('products')
        const batch = this.firestoreClient.batch()

        changedProducts.forEach(product => batch.update(collection.doc(product.id), { stripe: product.stripe }))
        try {
            await batch.commit()
            console.log('All product price changes updated successfully')
        } catch (err) {
            throw Error(err)
        }
    }

    async generateProduct(firebaseData: FProduct[]) {
        return await Promise.all(
            firebaseData.map(async (el) => {
                console.log(`Adding ${el.name} to stripe`)
                const product = await this.stripeClient.products.create({
                    name: el.name,
                    metadata: { id: el.id }
                })
                const price = await this.stripeClient.prices.create({
                    product: product.id,
                    currency: 'aud',
                    unit_amount: el.price
                })

                return { id: el.id, stripe: price.id }
            })
        )
    }

    async updatePrice2(firebaseData: FProduct[]) {
        return await Promise.all(
            firebaseData.map(async (el) => {
                console.log(`Updating ${el.name} prices to ${el.price}`)
                const oldPrice = await this.stripeClient.prices.update(el.stripe || '', { active: false })
                const newPrice = await this.stripeClient.prices.create({
                    product: oldPrice.product as string,
                    currency: 'aud',
                    unit_amount: el.price
                })

                return { id: el.id, stripe: newPrice.id }
            })
        )
    }

    async validateExisting(firebaseData: FProduct[], stripeData: SProduct[]) {
        firebaseData.forEach(firebase => {
            if (firebase.stripe != '') { // Price ID exists on Firebase
                const stripe = stripeData.find(stripe => stripe.price.id == firebase.stripe)
                if (stripe == undefined) // Price doesn't exist on Stripe
                    throw Error(`Product with price found in Firebase missing in Stripe: ${firebase.name}-${firebase.id}`)
            } else if (stripeData.find(stripe => stripe.metadata['id'] == firebase.id)) {
                throw Error(`Product found in Stripe with no price ID in Firebase: ${firebase.name}-${firebase.id}`)
            }
        })

        console.log('Stripe and Firebase data validated, no mismatch found')
    }

    isUnchanged(firebase: FProduct, stripeData: SProduct[]) {
        return stripeData.find(stripe =>
            stripe.price.id == firebase.stripe && stripe.price.unit_amount == firebase.price
        ) != undefined
    }
}

export interface FProduct {
    id: string
    stripe: string
    name: string
    price: number
}

export interface SProduct extends Stripe.Product {
    price: Stripe.Price
}