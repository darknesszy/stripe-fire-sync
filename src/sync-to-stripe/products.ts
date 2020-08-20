import { firestore } from 'firebase-admin'
import * as StripeAdmin from '../utils/stripe-admin'
import Stripe from 'stripe'

export const sync = async () => {
    const client = StripeAdmin.connect()
    const firebaseData = await firebaseProducts()
    const stripeData = await client.list()

    await validateExisting(firebaseData, stripeData)
    await updateFirebase([
        ...await generateProduct(firebaseData.filter(el => el.stripe == '')),
        ...await updatePrice(
            firebaseData.filter(firebase =>
                firebase.stripe != '' && !isUnchanged(firebase, stripeData)
            )
        )
    ])
}

const isUnchanged = (firebase: FProduct, stripeData: SProduct[]) => stripeData.find(stripe =>
    stripe.price.id == firebase.stripe && stripe.price.unit_amount == firebase.price
) != undefined

export const firebaseProducts = async () => {
    const client = firestore()
    const snapshots = await client.collection('products').get()

    const products = new Array<FProduct>()
    snapshots.forEach(doc => products.push({ ...doc.data() as FProduct, id: doc.id }))

    return products
}

export const updateFirebase = async (changedProducts: Array<{ id: string, stripe: string }>) => {
    const client = firestore()
    const collection = client.collection('products')
    const batch = client.batch()

    changedProducts.forEach(product => batch.update(collection.doc(product.id), { stripe: product.stripe }))
    try {
        await batch.commit()
        console.log('All product price changes updated successfully')
    } catch(err) {
        throw Error(err)
    }
}

export const generateProduct = async (firebaseData: FProduct[]) => {
    const client = StripeAdmin.getClient()

    return await Promise.all(firebaseData.map(async (el) => {
        console.log(`Adding ${el.name} to stripe`)
        const product = await client.products.create({
            name: el.name,
            metadata: { id: el.id }
        })
        const price = await client.prices.create({
            product: product.id,
            currency: 'aud',
            unit_amount: el.price
        })

        return { id: el.id, stripe: price.id }
    }))
}

export const updatePrice = async (firebaseData: FProduct[]) => {
    const client = StripeAdmin.getClient()

    return await Promise.all(firebaseData.map(async (el) => {
        console.log(`Updating ${el.name} prices to ${el.price}`)
        const oldPrice = await client.prices.update(el.stripe || '', { active: false })
        const newPrice = await client.prices.create({
            product: oldPrice.product as string,
            currency: 'aud',
            unit_amount: el.price
        })

        return { id: el.id, stripe: newPrice.id }
    }))
}

export const validateExisting = async (firebaseData: FProduct[], stripeData: SProduct[]) => {
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

export interface FProduct {
    id: string
    stripe: string
    name: string
    price: number
}

export interface SProduct extends Stripe.Product {
    price: Stripe.Price
}